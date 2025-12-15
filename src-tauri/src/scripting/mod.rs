use std::collections::HashMap;

use boa_engine::{Context, Source};
use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// Context provided to scripts (request data, environment variables, etc.)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptContext {
    pub method: String,
    pub url: String,
    pub headers: Vec<(String, String)>,
    pub body: Option<String>,
    pub environment: HashMap<String, String>,
    pub variables: HashMap<String, String>,
    /// Only populated for test scripts (after response)
    pub response: Option<ScriptResponseContext>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptResponseContext {
    pub status: u16,
    pub body: String,
    pub headers: HashMap<String, String>,
    pub response_time: u64,
}

/// Result of executing a pre-request script
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScriptResult {
    pub console_log: Vec<String>,
    pub updated_variables: HashMap<String, String>,
    pub updated_environment: HashMap<String, String>,
    pub error: Option<String>,
}

/// A single test result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestResult {
    pub name: String,
    pub passed: bool,
    pub error: Option<String>,
}

/// Result of executing a test script
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TestScriptResult {
    pub tests: Vec<TestResult>,
    pub console_log: Vec<String>,
    pub error: Option<String>,
}

/// Execute a pre-request script.
///
/// Strategy: We inject the pm object as pure JavaScript, run the user's script,
/// then read state back by evaluating `JSON.stringify(...)` on the captured data.
pub fn execute_pre_request_script(
    script: &str,
    ctx: &ScriptContext,
) -> Result<ScriptResult, AppError> {
    if script.trim().is_empty() {
        return Ok(ScriptResult {
            console_log: vec![],
            updated_variables: ctx.variables.clone(),
            updated_environment: ctx.environment.clone(),
            error: None,
        });
    }

    let mut context = Context::default();

    let env_json = serde_json::to_string(&ctx.environment).unwrap_or_else(|_| "{}".to_string());
    let vars_json = serde_json::to_string(&ctx.variables).unwrap_or_else(|_| "{}".to_string());
    let headers_json =
        serde_json::to_string(&ctx.headers).unwrap_or_else(|_| "[]".to_string());
    let body_json = match &ctx.body {
        Some(b) => serde_json::to_string(b).unwrap_or_else(|_| "null".to_string()),
        None => "null".to_string(),
    };

    // Setup script: create pm object with JS-only state management
    // Build the script by concatenating to avoid format! issues with JS braces
    let mut setup = String::new();
    setup.push_str("var __courier_logs = [];\n");
    setup.push_str(&format!("var __courier_env = {};\n", env_json));
    setup.push_str(&format!("var __courier_vars = {};\n", vars_json));
    setup.push_str(r#"
var console = {
    log: function() {
        var parts = [];
        for (var i = 0; i < arguments.length; i++) {
            parts.push(String(arguments[i]));
        }
        __courier_logs.push(parts.join(" "));
    },
    warn: function() { console.log.apply(null, arguments); },
    error: function() { console.log.apply(null, arguments); },
    info: function() { console.log.apply(null, arguments); }
};

var pm = {
    environment: {
        get: function(key) { return __courier_env[key]; },
        set: function(key, val) { __courier_env[key] = String(val); },
        toObject: function() { return __courier_env; }
    },
    variables: {
        get: function(key) { return __courier_vars[key]; },
        set: function(key, val) { __courier_vars[key] = String(val); },
        toObject: function() { return __courier_vars; }
    },
    request: {
"#);
    setup.push_str(&format!("        method: \"{}\",\n", escape_js_string(&ctx.method)));
    setup.push_str(&format!("        url: \"{}\",\n", escape_js_string(&ctx.url)));
    setup.push_str(&format!("        headers: {},\n", headers_json));
    setup.push_str(&format!("        body: {}\n", body_json));
    setup.push_str("    }\n};\n");

    let full_script = format!("{}\n{}", setup, script);

    let eval_result = context.eval(Source::from_bytes(&full_script));

    let script_error = match eval_result {
        Ok(_) => None,
        Err(e) => Some(format!("{}", e)),
    };

    // Read back state
    let console_log = read_json_array_of_strings(&mut context, "__courier_logs");
    let updated_env = read_json_hashmap(&mut context, "__courier_env");
    let updated_vars = read_json_hashmap(&mut context, "__courier_vars");

    Ok(ScriptResult {
        console_log,
        updated_variables: updated_vars.unwrap_or_else(|| ctx.variables.clone()),
        updated_environment: updated_env.unwrap_or_else(|| ctx.environment.clone()),
        error: script_error,
    })
}

/// Execute a test script (has access to pm.response + pm.test)
pub fn execute_test_script(
    script: &str,
    ctx: &ScriptContext,
) -> Result<TestScriptResult, AppError> {
    if script.trim().is_empty() {
        return Ok(TestScriptResult {
            tests: vec![],
            console_log: vec![],
            error: None,
        });
    }

    let mut context = Context::default();

    // Build response context as JS literal string
    let response_js = if let Some(ref resp) = ctx.response {
        let resp_headers_json =
            serde_json::to_string(&resp.headers).unwrap_or_else(|_| "{}".to_string());
        let resp_body_json =
            serde_json::to_string(&resp.body).unwrap_or_else(|_| "\"\"".to_string());
        let mut s = String::from("{\n");
        s.push_str(&format!("    status: {},\n", resp.status));
        s.push_str(&format!("    code: {},\n", resp.status));
        s.push_str(&format!("    body: {},\n", resp_body_json));
        s.push_str(&format!("    headers: {},\n", resp_headers_json));
        s.push_str(&format!("    responseTime: {},\n", resp.response_time));
        s.push_str("    json: function() { return JSON.parse(this.body); }\n");
        s.push_str("}");
        s
    } else {
        "null".to_string()
    };

    let mut setup = String::new();
    setup.push_str("var __courier_logs = [];\n");
    setup.push_str("var __courier_tests = [];\n");
    setup.push_str(r#"
var console = {
    log: function() {
        var parts = [];
        for (var i = 0; i < arguments.length; i++) {
            parts.push(String(arguments[i]));
        }
        __courier_logs.push(parts.join(" "));
    },
    warn: function() { console.log.apply(null, arguments); },
    error: function() { console.log.apply(null, arguments); },
    info: function() { console.log.apply(null, arguments); }
};

var pm = {
    test: function(name, fn) {
        try {
            var result = fn();
            if (result === false) {
                __courier_tests.push({ name: name, passed: false, error: "Assertion returned false" });
            } else {
                __courier_tests.push({ name: name, passed: true, error: null });
            }
        } catch (e) {
            __courier_tests.push({ name: name, passed: false, error: String(e) });
        }
    },
    expect: function(val) {
        return {
            to: {
                equal: function(expected) {
                    if (val !== expected) throw new Error("Expected " + JSON.stringify(expected) + " but got " + JSON.stringify(val));
                },
                be: function(expected) {
                    if (val !== expected) throw new Error("Expected " + JSON.stringify(expected) + " but got " + JSON.stringify(val));
                },
                include: function(str) {
                    if (typeof val === "string" && val.indexOf(str) === -1) throw new Error("Expected string to include " + JSON.stringify(str));
                    if (Array.isArray(val) && val.indexOf(str) === -1) throw new Error("Expected array to include " + JSON.stringify(str));
                },
                eql: function(expected) {
                    if (JSON.stringify(val) !== JSON.stringify(expected)) throw new Error("Expected deep equal to " + JSON.stringify(expected));
                },
                have: {
                    property: function(prop) {
                        if (typeof val !== "object" || val === null || !(prop in val)) throw new Error("Expected object to have property " + JSON.stringify(prop));
                    }
                }
            },
            toBe: function(expected) {
                if (val !== expected) throw new Error("Expected " + JSON.stringify(expected) + " but got " + JSON.stringify(val));
            },
            toEqual: function(expected) {
                if (JSON.stringify(val) !== JSON.stringify(expected)) throw new Error("Expected deep equal to " + JSON.stringify(expected));
            }
        };
    },
"#);
    setup.push_str(&format!("    response: {},\n", response_js));
    setup.push_str("    request: {\n");
    setup.push_str(&format!("        method: \"{}\",\n", escape_js_string(&ctx.method)));
    setup.push_str(&format!("        url: \"{}\"\n", escape_js_string(&ctx.url)));
    setup.push_str("    }\n};\n");

    let full_script = format!("{}\n{}", setup, script);

    let eval_result = context.eval(Source::from_bytes(&full_script));

    let script_error = match eval_result {
        Ok(_) => None,
        Err(e) => Some(format!("{}", e)),
    };

    // Read back state
    let console_log = read_json_array_of_strings(&mut context, "__courier_logs");
    let tests = read_test_results(&mut context);

    Ok(TestScriptResult {
        tests,
        console_log,
        error: script_error,
    })
}

/// Read a JS variable as JSON string array
fn read_json_array_of_strings(context: &mut Context, var_name: &str) -> Vec<String> {
    let expr = format!("JSON.stringify({})", var_name);
    match context.eval(Source::from_bytes(&expr)) {
        Ok(val) => {
            if let Some(s) = val.as_string() {
                let s = s.to_std_string_escaped();
                serde_json::from_str::<Vec<String>>(&s).unwrap_or_default()
            } else {
                vec![]
            }
        }
        Err(_) => vec![],
    }
}

/// Read a JS variable as HashMap<String, String>
fn read_json_hashmap(context: &mut Context, var_name: &str) -> Option<HashMap<String, String>> {
    let expr = format!("JSON.stringify({})", var_name);
    match context.eval(Source::from_bytes(&expr)) {
        Ok(val) => {
            if let Some(s) = val.as_string() {
                let s = s.to_std_string_escaped();
                serde_json::from_str::<HashMap<String, String>>(&s).ok()
            } else {
                None
            }
        }
        Err(_) => None,
    }
}

/// Read test results from __courier_tests JS variable
fn read_test_results(context: &mut Context) -> Vec<TestResult> {
    let expr = "JSON.stringify(__courier_tests)";
    match context.eval(Source::from_bytes(expr)) {
        Ok(val) => {
            if let Some(s) = val.as_string() {
                let s = s.to_std_string_escaped();
                serde_json::from_str::<Vec<TestResult>>(&s).unwrap_or_default()
            } else {
                vec![]
            }
        }
        Err(_) => vec![],
    }
}

fn escape_js_string(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
}

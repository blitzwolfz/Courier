pub mod client;

use prost::Message;
use prost_reflect::{DescriptorPool, MessageDescriptor, MethodDescriptor};
use serde::{Deserialize, Serialize};

use crate::error::AppError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtoField {
    pub name: String,
    pub field_type: String,
    pub number: u32,
    pub is_repeated: bool,
    pub is_map: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtoMessage {
    pub full_name: String,
    pub fields: Vec<ProtoField>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtoMethod {
    pub name: String,
    pub full_name: String,
    pub input_type: String,
    pub output_type: String,
    pub client_streaming: bool,
    pub server_streaming: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtoService {
    pub name: String,
    pub full_name: String,
    pub methods: Vec<ProtoMethod>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtoDefinition {
    pub services: Vec<ProtoService>,
    pub messages: Vec<ProtoMessage>,
}

fn field_type_name(field: &prost_reflect::FieldDescriptor) -> String {
    use prost_reflect::Kind;
    match field.kind() {
        Kind::Double => "double".to_string(),
        Kind::Float => "float".to_string(),
        Kind::Int32 => "int32".to_string(),
        Kind::Int64 => "int64".to_string(),
        Kind::Uint32 => "uint32".to_string(),
        Kind::Uint64 => "uint64".to_string(),
        Kind::Sint32 => "sint32".to_string(),
        Kind::Sint64 => "sint64".to_string(),
        Kind::Fixed32 => "fixed32".to_string(),
        Kind::Fixed64 => "fixed64".to_string(),
        Kind::Sfixed32 => "sfixed32".to_string(),
        Kind::Sfixed64 => "sfixed64".to_string(),
        Kind::Bool => "bool".to_string(),
        Kind::String => "string".to_string(),
        Kind::Bytes => "bytes".to_string(),
        Kind::Message(msg) => msg.full_name().to_string(),
        Kind::Enum(e) => e.full_name().to_string(),
    }
}

pub fn parse_proto(proto_content: &str) -> Result<(ProtoDefinition, DescriptorPool), AppError> {
    // Write proto content to a temp file so protox can read it
    let temp_dir = std::env::temp_dir().join("courier_proto");
    std::fs::create_dir_all(&temp_dir)
        .map_err(|e| AppError::Internal(format!("Failed to create temp dir: {}", e)))?;
    let proto_path = temp_dir.join("input.proto");
    std::fs::write(&proto_path, proto_content)
        .map_err(|e| AppError::Internal(format!("Failed to write temp proto: {}", e)))?;

    let file_descriptor_set = protox::compile(&["input.proto"], &[&temp_dir])
        .map_err(|e| AppError::Internal(format!("Proto compile error: {}", e)))?;

    // Clean up
    let _ = std::fs::remove_file(&proto_path);

    // Create a descriptor pool from the compiled proto
    let bytes = file_descriptor_set.encode_to_vec();
    let pool = DescriptorPool::decode(bytes.as_slice())
        .map_err(|e| AppError::Internal(format!("Descriptor pool error: {}", e)))?;

    let mut services = Vec::new();
    let mut messages = Vec::new();

    for service in pool.services() {
        let mut methods = Vec::new();
        for method in service.methods() {
            methods.push(ProtoMethod {
                name: method.name().to_string(),
                full_name: method.full_name().to_string(),
                input_type: method.input().full_name().to_string(),
                output_type: method.output().full_name().to_string(),
                client_streaming: method.is_client_streaming(),
                server_streaming: method.is_server_streaming(),
            });
        }
        services.push(ProtoService {
            name: service.name().to_string(),
            full_name: service.full_name().to_string(),
            methods,
        });
    }

    for message in pool.all_messages() {
        let mut fields = Vec::new();
        for field in message.fields() {
            fields.push(ProtoField {
                name: field.name().to_string(),
                field_type: field_type_name(&field),
                number: field.number(),
                is_repeated: field.is_list(),
                is_map: field.is_map(),
            });
        }
        messages.push(ProtoMessage {
            full_name: message.full_name().to_string(),
            fields,
        });
    }

    Ok((
        ProtoDefinition { services, messages },
        pool,
    ))
}

pub fn get_method_descriptor(
    pool: &DescriptorPool,
    service_name: &str,
    method_name: &str,
) -> Result<MethodDescriptor, AppError> {
    // Try to find the service by full name or name
    let service = pool
        .services()
        .find(|s| s.full_name() == service_name || s.name() == service_name)
        .ok_or_else(|| AppError::NotFound(format!("Service not found: {}", service_name)))?;

    let method = service
        .methods()
        .find(|m| m.name() == method_name || m.full_name() == method_name)
        .ok_or_else(|| AppError::NotFound(format!("Method not found: {}", method_name)))?;

    Ok(method)
}

pub fn json_to_message(
    json_str: &str,
    descriptor: &MessageDescriptor,
) -> Result<prost_reflect::DynamicMessage, AppError> {
    let mut deserializer = serde_json::Deserializer::from_str(json_str);
    let message = prost_reflect::DynamicMessage::deserialize(descriptor.clone(), &mut deserializer)
        .map_err(|e| AppError::Internal(format!("JSON to protobuf error: {}", e)))?;
    Ok(message)
}

pub fn message_to_json(
    message: &prost_reflect::DynamicMessage,
) -> Result<String, AppError> {
    serde_json::to_string_pretty(message)
        .map_err(|e| AppError::Internal(format!("Protobuf to JSON error: {}", e)))
}

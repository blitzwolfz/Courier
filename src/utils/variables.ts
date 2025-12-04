import type { Environment, EnvironmentVariable } from '../types/environment';

export function interpolateVariables(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, varName) => {
    return variables[varName] ?? `{{${varName}}}`;
  });
}

export function buildVariableMap(
  environments: Environment[],
  activeId: string | null
): Record<string, string> {
  if (!activeId) return {};
  const active = environments.find((e) => e.id === activeId);
  if (!active) return {};

  const map: Record<string, string> = {};
  const vars = active.variables as unknown as EnvironmentVariable[];
  if (Array.isArray(vars)) {
    for (const v of vars) {
      if (v.enabled) {
        map[v.key] = v.value;
      }
    }
  }
  return map;
}

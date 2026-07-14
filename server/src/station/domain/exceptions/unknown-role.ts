export class UnknownRole extends Error {
  constructor(role: string, declared: string[]) {
    super(`role '${role}' is not declared by the stack (declared: ${declared.join(", ")}).`);
  }
}

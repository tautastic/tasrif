export interface VerbFormResolutionResponse {
  classification: string[] | null;
  rootError: string | null;
  pattern: { id: number; description: string } | null;
}

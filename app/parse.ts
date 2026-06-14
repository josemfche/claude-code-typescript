import { ParseResult } from "effect";

export const formatParseError = (error: ParseResult.ParseError): string =>
  ParseResult.TreeFormatter.formatErrorSync(error);

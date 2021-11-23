import { S3Error } from "./error.ts";
import { decodeXMLEntities } from "../deps.ts";

export interface Document {
  declaration: {
    attributes: Record<string, unknown>;
  };
  root: Xml | undefined;
}

export interface Xml {
  name: string;
  attributes: unknown;
  children: Xml[];
  content?: string;
}

export function extractRoot(doc: Document, name: string): Xml {
  if (!doc.root || doc.root.name !== name) {
    throw new S3Error(
      `Malformed XML document. Missing ${name} field.`,
      JSON.stringify(doc, undefined, 2),
    );
  }
  return doc.root;
}

export function extractField(node: Xml, name: string): Xml | undefined {
  return node.children.find((node) => node.name === name);
}

export function extractFields(node: Xml, name: string): Array<Xml> {
  return node.children.filter((node) => node.name === name);
}

export function extractContent(node: Xml, name: string): string | undefined {
  const field = extractField(node, name);
  const content = field?.content;
  if (content === undefined) {
    return content;
  }
  return decodeXMLEntities(content);
}

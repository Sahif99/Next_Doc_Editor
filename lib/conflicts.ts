export function hasRevisionConflict({
  baseRevision,
  currentRevision,
  force,
}: {
  baseRevision?: number;
  currentRevision: number;
  force?: boolean;
}) {
  return baseRevision !== undefined && baseRevision < currentRevision && !force;
}

function tokenizeHtml(content: string) {
  return content
    .replace(/(<\/(?:p|div|h1|h2|h3|blockquote|li|pre|ul|ol)>)/gi, "$1\n")
    .replace(/(<br\s*\/?>)/gi, "$1\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function commonPrefixLength(left: string[], right: string[]) {
  let index = 0;

  while (index < left.length && index < right.length && left[index] === right[index]) {
    index += 1;
  }

  return index;
}

function commonSuffixLength(left: string[], right: string[], prefixLength: number) {
  let count = 0;

  while (
    count + prefixLength < left.length &&
    count + prefixLength < right.length &&
    left[left.length - 1 - count] === right[right.length - 1 - count]
  ) {
    count += 1;
  }

  return count;
}

function joinBlocks(blocks: string[]) {
  return blocks.join("");
}

export function mergeDocumentContent(
  serverContent: string,
  clientContent: string,
  baseContent = ""
) {
  if (serverContent === clientContent) return serverContent;
  if (serverContent === baseContent) return clientContent;
  if (clientContent === baseContent) return serverContent;

  const server = tokenizeHtml(serverContent);
  const client = tokenizeHtml(clientContent);
  const prefixLength = commonPrefixLength(server, client);
  const suffixLength = commonSuffixLength(server, client, prefixLength);

  const prefix = server.slice(0, prefixLength);
  const serverChanged = server.slice(prefixLength, server.length - suffixLength);
  const clientChanged = client.slice(prefixLength, client.length - suffixLength);
  const suffix = server.slice(server.length - suffixLength);

  if (joinBlocks(serverChanged) === joinBlocks(clientChanged)) {
    return joinBlocks([...prefix, ...serverChanged, ...suffix]);
  }

  return joinBlocks([
    ...prefix,
    '<section data-conflict="server"><p><strong>Server version</strong></p>',
    ...serverChanged,
    "</section>",
    '<section data-conflict="local"><p><strong>Merged local changes</strong></p>',
    ...clientChanged,
    "</section>",
    ...suffix,
  ]);
}

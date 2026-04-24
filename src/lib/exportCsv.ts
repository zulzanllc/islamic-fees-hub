type DownloadCsvOptions = {
  includeSeparatorHint?: boolean;
  delimiter?: string;
  encoding?: "utf-8" | "utf-16le";
};

function downloadCSV(
  filename: string,
  headers: string[],
  rows: string[][],
  options: DownloadCsvOptions = {}
) {
  const delimiter = options.delimiter ?? ",";
  const csvBody = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(delimiter))
    .join("\r\n");
  const csv = options.includeSeparatorHint ? `sep=${delimiter}\r\n${csvBody}` : csvBody;
  const encoding = options.encoding ?? "utf-8";
  const blob =
    encoding === "utf-16le"
      ? new Blob([new Uint8Array([0xff, 0xfe]), encodeUtf16Le(csv)], {
          type: "text/csv;charset=utf-16le;",
        })
      : new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function encodeUtf16Le(value: string) {
  const bytes = new Uint8Array(value.length * 2);

  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    bytes[i * 2] = code & 0xff;
    bytes[i * 2 + 1] = code >> 8;
  }

  return bytes;
}

export { downloadCSV };

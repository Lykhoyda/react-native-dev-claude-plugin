export function textResult(text) {
    return { content: [{ type: 'text', text }] };
}
export function errorResult(text) {
    return { content: [{ type: 'text', text }], isError: true };
}

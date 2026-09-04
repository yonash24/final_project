declare module 'word-extractor' {
    class Document {
        getBody(): string;
        getHeaders(): string;
        getTextboxes(): string;
        getFootnotes(): string;
        getEndnotes(): string;
    }
    export default class WordExtractor {
        extract(input: Buffer): Promise<Document>;
    }
}

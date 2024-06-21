import * as langchain_dist_document from 'langchain/dist/document';

declare const docsFromFigma: (key: string, nodes: string[], figmaApiKey: string) => Promise<langchain_dist_document.Document<Record<string, any>>[]>;
declare function transformFigma(figmaUrl: string, figmaApiKey: string, openaiApiKey: string): Promise<{
    id: string;
    name: string;
    schema: string;
    component: string;
}[] | undefined>;

export { docsFromFigma, transformFigma };

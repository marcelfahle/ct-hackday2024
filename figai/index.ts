import * as Figma from 'figma-api';
import { GetFileResult } from 'figma-api/lib/api-types';
import 'dotenv/config'
// import { MemoryVectorStore } from 'langchain/vectorstores/memory'
import { FigmaFileLoader } from 'langchain/document_loaders/web/figma'
// import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import OpenAI from 'openai'

// export const createStore = (docs) =>
//   MemoryVectorStore.fromDocuments(docs, new OpenAIEmbeddings())
//
export const docsFromFigma = async (key: string, nodes: string[], figmaApiKey: string) => {
  const loader = new FigmaFileLoader({
    accessToken: figmaApiKey,
    nodeIds: nodes,
    fileKey: key,
  });

  const docs = await loader.load();
  return docs;
}


function getComponentsFromFigma(figmaJSON: GetFileResult, prefix = "coFE_") {
  const filteredComponents = Object.entries(figmaJSON.components)
    .filter(([_id, component]) => component.name.startsWith(prefix))
    .map(([id, component]) => (
      {
        id: id,
        name: component.name,
      }));

  return filteredComponents;
}

function reduceFigmaComponentJson(obj: any, whitelist = ["id", "name", "type", "children"]): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => reduceFigmaComponentJson(item, whitelist));
  }

  const filteredObj: any = {};
  for (let key in obj) {
    if (whitelist.includes(key)) {
      filteredObj[key] = reduceFigmaComponentJson(obj[key], whitelist);
    }
  }

  return filteredObj;
}

function getFigmaKeyFromUrl(url: string) {
  const regex = /(?:https?:\/\/)?(?:www\.)?figma\.com\/file\/([a-zA-Z0-9_-]+)/

  const match = url.match(regex)
  if (match && match[1]) {
    const figmaKey = match[1]
    return figmaKey
  } else {
    throw new Error('ID not found in the URL')
  }
}

export async function transformFigma(figmaUrl: string, figmaApiKey: string, openaiApiKey: string) {
  console.log('starting', figmaApiKey, openaiApiKey)
  const api = new Figma.Api({
    personalAccessToken: figmaApiKey,
  });
  const openai = new OpenAI({
    apiKey: openaiApiKey,
    dangerouslyAllowBrowser: true
  })


  try {
    const figmaKey = getFigmaKeyFromUrl(figmaUrl)
    const file: GetFileResult = await api.getFile(figmaKey);
    // write backup
    // await fs.writeFile(`./main.json`, JSON.stringify(file, null, 2))
    // get components
    console.log('parsing components from Figma')
    const figmaComponents = getComponentsFromFigma(file)

    console.log('creating documents for VectorStore')
    const requests = figmaComponents.map(async ({ id, name }) => {
      const doc = await docsFromFigma(figmaKey, [id], figmaApiKey)
      // should be tested if it's placed correctly here.
      // function takes a whitelist as second argument
      // but takes id, name, type and children as default values / whitelist
      const reducedDoc: any = reduceFigmaComponentJson(doc)

      const context = reducedDoc.map((r: { pageContent: string }) => r.pageContent).join('\n');

      let schema, component;
      console.log(`processing ${name}`)

      if (context.length > 30000) {
        schema = "TOO_LONG"
        component = "TOO_LONG"
      } else {
        const response = await openai.chat.completions.create({
          model: 'gpt-4-turbo-preview',
          temperature: 0.02,
          messages: [
            {
              role: 'assistant',
              content:
                `You are an expert coder. Use the provided context, which is a figma design file, to create a JSON schema file for commercetools frontend with the following specs:

                The basic schema looks like this:
                {
                    "tasticType": "demo/example",
                    "name": "Example schema",
                    "category": "Examples",
                    "icon": "info",
                    "schema": [
                        {
                        "name": "Content API configuration",
                        "fields": [
                            {
                            "label": "Enter Content ID",
                            "field": "contentID",
                            "type": "string"
                            }
                        ]
                        }
                    ]
                    // Other schema properties.
                }
                The goal is to identify fields in the figma design, that should be editable in a CMS.
                Common field types are "string", "text" (for longer content), "reference" (for links) and "media" for images.

                So for example, when I see a normal text, a header or similar, I'd use the field string:

                    {
                    "label": "Headline",
                    "field": "label",
                    "type": "string"
                    }

                A link or a button, could be a "reference", where we also have a label attribute in the field (so no need for a separate label string field)

                    {
                    "label": "Link",
                    "field": "reference",
                    "type": "reference",
                    "required": false,
                    "default": null
                    }

                Lastly, an image should be represented as a "media" type. For example:

                    {
                    "label": "Image",
                    "field": "image",
                    "type": "media",
                    "required": true
                    }


                Besides the schema, can you also add a very basic react component (function component), that takes in all those props from the schema within an object called data?
                So for example when we have a hero schema with a string field named "headline" in the schema, the props for the react component would look like this:
                export function Hero({data}) {
                    const { headline } = data;
                }


                Output please the schema and the react component as copy-pastable text. Can you add a divider string between the schema and the component, for example "=====", so I have an easier time splitting your answer
                Everything must be inline in one file and your response must be directly renderable by the browser. don't return any explanations or further information, just the component, no text`,
            },
            {
              role: 'user',
              content: `Can you analyze the follwing figma design and create a json schema?

                    Context: ${doc.map((r) => r.pageContent).join('\n')}`,
            },
          ],
        })
        const answer = response?.choices[0]?.message?.content?.split("=====") || ["NO_GPT_ANSWER", "NO_GPT_ANSWER"]
        schema = answer[0]
        component = answer[1]
        console.log(`${name} done`)
      }

      return { id, name, schema, component }
    });

    const result = await Promise.all(requests)
    console.log(result)

    return result;

  } catch (e) {
    console.error(e)
  }
}


// transformFigma('https://www.figma.com/file/FBGEDhpvEJJBN67FDawaCx/Hack?type=design&node-id=0-512&mode=design&t=M7qGL19h8JXlENK8-0', process.env.FIGMA_ACCESS_TOKEN as string, process.env.OPENAI_API_KEY as string)

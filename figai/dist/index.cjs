"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// index.ts
var figai_exports = {};
__export(figai_exports, {
  docsFromFigma: () => docsFromFigma,
  transformFigma: () => transformFigma
});
module.exports = __toCommonJS(figai_exports);
var Figma = __toESM(require("figma-api"), 1);
var import_config = require("dotenv/config");
var import_figma = require("langchain/document_loaders/web/figma");
var import_openai = __toESM(require("openai"), 1);
var docsFromFigma = async (key, nodes, figmaApiKey) => {
  const loader = new import_figma.FigmaFileLoader({
    accessToken: figmaApiKey,
    nodeIds: nodes,
    fileKey: key
  });
  const docs = await loader.load();
  return docs;
};
function getComponentsFromFigma(figmaJSON, prefix = "coFE_") {
  const filteredComponents = Object.entries(figmaJSON.components).filter(([_id, component]) => component.name.startsWith(prefix)).map(([id, component]) => ({
    id,
    name: component.name
  }));
  return filteredComponents;
}
function reduceFigmaComponentJson(obj, whitelist = ["id", "name", "type", "children"]) {
  if (typeof obj !== "object" || obj === null) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => reduceFigmaComponentJson(item, whitelist));
  }
  const filteredObj = {};
  for (let key in obj) {
    if (whitelist.includes(key)) {
      filteredObj[key] = reduceFigmaComponentJson(obj[key], whitelist);
    }
  }
  return filteredObj;
}
function getFigmaKeyFromUrl(url) {
  const regex = /(?:https?:\/\/)?(?:www\.)?figma\.com\/file\/([a-zA-Z0-9_-]+)/;
  const match = url.match(regex);
  if (match && match[1]) {
    const figmaKey = match[1];
    return figmaKey;
  } else {
    throw new Error("ID not found in the URL");
  }
}
async function transformFigma(figmaUrl, figmaApiKey, openaiApiKey) {
  console.log("starting", figmaApiKey, openaiApiKey);
  const api = new Figma.Api({
    personalAccessToken: figmaApiKey
  });
  const openai = new import_openai.default({
    apiKey: openaiApiKey,
    dangerouslyAllowBrowser: true
  });
  try {
    const figmaKey = getFigmaKeyFromUrl(figmaUrl);
    const file = await api.getFile(figmaKey);
    console.log("parsing components from Figma");
    const figmaComponents = getComponentsFromFigma(file);
    console.log("creating documents for VectorStore");
    const requests = figmaComponents.map(async ({ id, name }) => {
      var _a, _b, _c;
      const doc = await docsFromFigma(figmaKey, [id], figmaApiKey);
      const reducedDoc = reduceFigmaComponentJson(doc);
      const context = reducedDoc.map((r) => r.pageContent).join("\n");
      let schema, component;
      console.log(`processing ${name}`);
      if (context.length > 3e4) {
        schema = "TOO_LONG";
        component = "TOO_LONG";
      } else {
        const response = await openai.chat.completions.create({
          model: "gpt-4-turbo-preview",
          temperature: 0.02,
          messages: [
            {
              role: "assistant",
              content: `You are an expert coder. Use the provided context, which is a figma design file, to create a JSON schema file for commercetools frontend with the following specs:

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
                Everything must be inline in one file and your response must be directly renderable by the browser. don't return any explanations or further information, just the component, no text`
            },
            {
              role: "user",
              content: `Can you analyze the follwing figma design and create a json schema?

                    Context: ${doc.map((r) => r.pageContent).join("\n")}`
            }
          ]
        });
        const answer = ((_c = (_b = (_a = response == null ? void 0 : response.choices[0]) == null ? void 0 : _a.message) == null ? void 0 : _b.content) == null ? void 0 : _c.split("=====")) || ["NO_GPT_ANSWER", "NO_GPT_ANSWER"];
        schema = answer[0];
        component = answer[1];
        console.log(`${name} done`);
      }
      return { id, name, schema, component };
    });
    const result = await Promise.all(requests);
    console.log(result);
    return result;
  } catch (e) {
    console.error(e);
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  docsFromFigma,
  transformFigma
});
//# sourceMappingURL=index.cjs.map
import 'dotenv/config'
import { MemoryVectorStore } from 'langchain/vectorstores/memory'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { YoutubeLoader } from 'langchain/document_loaders/web/youtube'
import { CharacterTextSplitter } from 'langchain/text_splitter'
import { PDFLoader } from 'langchain/document_loaders/fs/pdf'
import { openai } from './openai.js'
import { FigmaFileLoader } from 'langchain/document_loaders/web/figma'

const question = process.argv[2] || 'hi'

const figma = `https://www.figma.com/file/FBGEDhpvEJJBN67FDawaCx/Untitled?type=design&node-id=0%3A512&mode=design&t=ytBJuT3hZ5Bq7kEY-1`

export const createStore = (docs) =>
  MemoryVectorStore.fromDocuments(docs, new OpenAIEmbeddings())

export const docsFromFigma = async () => {
  const loader = new FigmaFileLoader({
    accessToken: process.env.FIGMA_ACCESS_TOKEN,
    nodeIds: ["0%3A512"],
    fileKey: "FBGEDhpvEJJBN67FDawaCx",
  });

  const docs = await loader.load();
  console.log(docs)
}

export const docsFromYTVideo = async (video) => {
  const loader = YoutubeLoader.createFromUrl(video, {
    language: 'en',
    addVideoInfo: true,
  })
  return loader.loadAndSplit(
    new CharacterTextSplitter({
      separator: ' ',
      chunkSize: 2500,
      chunkOverlap: 100,
    })
  )
}

export const docsFromPDF = () => {
  const loader = new PDFLoader('xbox.pdf')
  return loader.loadAndSplit(
    new CharacterTextSplitter({
      separator: '. ',
      chunkSize: 2500,
      chunkOverlap: 200,
    })
  )
}

const loadStore = async () => {
  // const videoDocs = await docsFromYTVideo(video)
  // const pdfDocs = await docsFromPDF()
  const figmaDocs = await docsFromFigma()

  return createStore([...figmaDocs])
}

const query = async () => {
  const store = await loadStore()
  const results = await store.similaritySearch(question, 1)

  const response = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo-16k-0613',
    temperature: 0,
    messages: [
      {
        role: 'assistant',
        content:
          'You are John Carmack, the best HTML Developer on the face of the planet.',
      },
      {
        role: 'user',
        content: `Create the most leanest and meanest HTML Code based on the context provided, which is a Figma File. Turn it into a working website.
  
        Context: ${results.map((r) => r.pageContent).join('\n')}`,
      },
    ],
  })
  console.log(
    `Answer: ${response.choices[0].message.content}\n\nSources: ${results
      .map((r) => r.metadata.source)
      .join(', ')}`
  )
}

// query()
await docsFromFigma()

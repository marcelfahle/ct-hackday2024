"use server";
import { transformFigma } from "figai";

export async function transform(
  figmaApiKey: string,
  figmaUrl: string,
  openApiKey: string,
) {
  const res = await transformFigma(figmaUrl, figmaApiKey, openApiKey);
  console.log(res);
}

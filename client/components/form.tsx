"use client";
import React, { useState } from "react";

export function Form({ onSubmit }: { onSubmit: any }) {
  const [figmaUrl, setFigmaUrl] = useState<string>(
    "https://www.figma.com/file/FBGEDhpvEJJBN67FDawaCx/Hack?type=design&node-id=0-512&mode=design&t=M7qGL19h8JXlENK8-0",
  );
  const [figmaApiKey, setFigmaApiKey] = useState<string>("");

  const handleSubmit: any = () => {
    onSubmit(figmaUrl, figmaApiKey);
  };

  return (
    <div className="flex flex-col gap-y-2">
      <input
        type="text"
        value={figmaApiKey}
        onChange={(e) => setFigmaApiKey(e.currentTarget.value)}
      />
      <input
        type="text"
        value={figmaUrl}
        onChange={(e) => setFigmaUrl(e.currentTarget.value)}
      />
      <button onClick={handleSubmit}>Create</button>
    </div>
  );
}

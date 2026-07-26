"use client";

import React, { useRef, useState } from "react";
import { FileUp, FileIcon, Trash, Open } from "./Icons";
import { AttachmentMeta, fileSize } from "@/lib/types";
import { openFileInTab } from "@/lib/storage";

export default function Dropzone({
  title,
  hint,
  attachments,
  onAdd,
  onRemove,
}: {
  title: string;
  hint: string;
  attachments: AttachmentMeta[];
  onAdd: (files: FileList | File[]) => void;
  onRemove: (id: string) => void;
}) {
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <div
        className={`dropzone${drag ? " drag" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (e.dataTransfer.files?.length) onAdd(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        style={{ cursor: "pointer" }}
      >
        <div style={{ display: "grid", placeItems: "center", gap: 8 }}>
          <FileUp size={22} />
          <div className="di">{title}</div>
          <div className="ds">{hint}</div>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) onAdd(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {attachments.length > 0 && (
        <div className="filelist">
          {attachments.map((a) => (
            <div className="fileitem" key={a.id}>
              <div className="fi-ic">
                <FileIcon size={16} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="fi-name">{a.name}</div>
                <div className="fi-sub">
                  {fileSize(a.size)} · {new Date(a.addedAt).toLocaleDateString()}
                </div>
              </div>
              <div className="fi-actions">
                <button
                  className="mini"
                  onClick={(e) => {
                    e.stopPropagation();
                    openFileInTab(a.path);
                  }}
                  title="Open"
                >
                  <Open size={13} />
                </button>
                <button
                  className="mini danger"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(a.id);
                  }}
                  title="Remove"
                >
                  <Trash size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

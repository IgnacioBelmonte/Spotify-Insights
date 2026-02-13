"use client";

import Image from "next/image";

interface CompactPlaylistItemProps {
  id: string;
  name: string;
  imageUrl: string | null;
  meta: string;
  isSelected: boolean;
  onSelect: (playlistId: string) => void;
}

export function CompactPlaylistItem({
  id,
  name,
  imageUrl,
  meta,
  isSelected,
  onSelect,
}: CompactPlaylistItemProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      className={`group w-full rounded-xl border px-3 py-2 text-left transition-colors ${
        isSelected
          ? "border-[#47a48b] bg-[#123039]"
          : "border-[#23434c] bg-[#0c2029] hover:border-[#3b7482] hover:bg-[#102734]"
      }`}
    >
      <div className="flex items-center gap-2.5">
        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-[#2c5860] bg-[#10232d]">
          {imageUrl ? (
            <Image src={imageUrl} alt={name} fill sizes="44px" className="object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-[#15323f] via-[#112531] to-[#0a161d] text-sm font-semibold text-[#9bcfc4]">
              {name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{name}</p>
          <p className="truncate text-xs text-slate-400">{meta}</p>
        </div>

        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#2a605f] bg-[#102a2f] text-[#d7f2eb] transition-colors group-hover:border-[#43ba98] group-hover:text-white">
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true">
            <path
              d="M7.5 4.5L13 10l-5.5 5.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
    </button>
  );
}

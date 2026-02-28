"use client";

import { useState, useRef } from "react";
import { Search, X } from "lucide-react";
import { Button } from "./button";

interface SearchBarProps {
  defaultValue?: string;
  placeholder?: string;
  /** Called only when Search button is clicked or Enter is pressed */
  onSearch: (query: string) => void;
  className?: string;
}

export function SearchBar({
  defaultValue = "",
  placeholder = "Search...",
  onSearch,
  className,
}: SearchBarProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  function commit() {
    onSearch(value.trim());
  }

  function clear() {
    setValue("");
    onSearch("");
    inputRef.current?.focus();
  }

  return (
    <div className={`flex gap-2 ${className ?? ""}`}>
      <div className="relative flex-1 min-w-0">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") clear();
          }}
          placeholder={placeholder}
          className="pl-9 pr-8 h-9 w-full rounded-md border border-gray-200 bg-white text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 transition-shadow"
        />
        {value && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
            tabIndex={-1}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <Button size="sm" onClick={commit} className="shrink-0">
        <Search className="w-4 h-4" />
        Search
      </Button>
    </div>
  );
}

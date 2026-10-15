import type { CharacterAsset } from "@mentor-bti/bti-core";

/** The locked 16-type sheets follow the annotated overview: S/F = row, C/O = column. */
export function getCharacterCrop(code: string, asset: CharacterAsset | null | undefined): { isSheet: boolean; column: "0%" | "-100%"; row: "0%" | "-100%" } {
  const isSheet = asset?.status === "sheet";
  return {
    isSheet,
    column: isSheet && code[3] === "O" ? "-100%" : "0%",
    row: isSheet && code[2] === "F" ? "-100%" : "0%"
  };
}

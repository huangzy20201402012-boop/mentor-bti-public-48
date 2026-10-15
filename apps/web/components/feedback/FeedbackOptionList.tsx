"use client";

import type { ChipOption } from "./FeedbackChipGroup";

export interface FeedbackOptionListProps<T extends string> {
  name: string;
  legend: string;
  options: Array<ChipOption<T>>;
  value: T | null;
  /** `stack` 纵向列表（题目反馈原因）；`wrap` 折叠成一行 chip（全站反馈类型）。 */
  variant?: "stack" | "wrap";
  disabled?: boolean;
  onChange: (value: T) => void;
}

/**
 * 单选原因列表。与 N/A 选项在视觉上明确不同：这里是表单里的 radio，
 * 不是答题卡上的选项按钮。
 */
export function FeedbackOptionList<T extends string>({
  name,
  legend,
  options,
  value,
  variant = "stack",
  disabled,
  onChange
}: FeedbackOptionListProps<T>) {
  return (
    <fieldset className="feedback-options" disabled={disabled}>
      <legend className="feedback-legend">{legend}</legend>
      <div className={variant === "wrap" ? "feedback-option-list is-wrap" : "feedback-option-list"}>
        {options.map((option) => (
          <label className={value === option.value ? "feedback-option is-selected" : "feedback-option"} key={option.value}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="feedback-option-mark" aria-hidden="true" />
            <span className="feedback-option-label">{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

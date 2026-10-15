"use client";

export interface ChipOption<T extends string> {
  value: T;
  label: string;
}

export interface FeedbackChipGroupProps<T extends string> {
  legend: string;
  hint?: string;
  options: Array<ChipOption<T>>;
  selected: T[];
  max?: number;
  disabled?: boolean;
  onToggle: (value: T) => void;
}

/**
 * 多选原因标签。底层是原生 checkbox，选中态用 CSS 呈现为 chip，输入框本身
 * 视觉隐藏但保留焦点环，键盘空格即可切换。
 */
export function FeedbackChipGroup<T extends string>({
  legend,
  hint,
  options,
  selected,
  max,
  disabled,
  onToggle
}: FeedbackChipGroupProps<T>) {
  const atLimit = max !== undefined && selected.length >= max;

  return (
    <fieldset className="feedback-chips" disabled={disabled}>
      <legend className="feedback-legend">
        {legend}
        <span className="feedback-optional">选填</span>
      </legend>
      {hint ? <p className="feedback-hint">{hint}</p> : null}
      <div className="feedback-chip-list">
        {options.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <label
              className={isSelected ? "feedback-chip is-selected" : "feedback-chip"}
              key={option.value}
              data-at-limit={!isSelected && atLimit ? "true" : undefined}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={disabled || (!isSelected && atLimit)}
                onChange={() => onToggle(option.value)}
              />
              <span>{option.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

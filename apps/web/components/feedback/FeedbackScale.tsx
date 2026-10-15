"use client";

export interface ScaleOption {
  value: number;
  label: string;
}

export interface FeedbackScaleProps {
  name: string;
  legend: string;
  hint?: string;
  value: number | null;
  options: ScaleOption[];
  disabled?: boolean;
  onChange: (value: number) => void;
}

/**
 * 1–5 认可度。使用原生 radio，因此方向键切换、读屏播报与 tab 焦点都由浏览器
 * 提供，不需要自建 roving tabindex。窄屏下滑为单列，避免五个热区挤在一起
 * 低于 44px 的触控标准。
 */
export function FeedbackScale({ name, legend, hint, value, options, disabled, onChange }: FeedbackScaleProps) {
  return (
    <fieldset className="feedback-scale" disabled={disabled}>
      <legend className="feedback-legend">{legend}</legend>
      {hint ? <p className="feedback-hint">{hint}</p> : null}
      <div className="feedback-scale-options">
        {options.map((option) => (
          <label
            className={value === option.value ? "feedback-scale-item is-selected" : "feedback-scale-item"}
            key={option.value}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span className="feedback-scale-mark" aria-hidden="true">{option.value}</span>
            <span className="feedback-scale-label">{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

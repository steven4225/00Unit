import React from "react";

const actions = ["开始模拟", "暂停", "重置", "生成总结"] as const;

export function ControlBar() {
  return (
    <section
      aria-labelledby="control-area-title"
      className="rounded-[24px] border border-slate-200 bg-slate-50/80 p-5"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2
            id="control-area-title"
            className="text-lg font-semibold text-slate-900"
          >
            控制区
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            当前 PR 只搭工作台骨架，按钮先作为交互占位。
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {actions.map((label) => (
            <button
              key={label}
              type="button"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-950"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

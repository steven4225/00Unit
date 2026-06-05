import React from "react";
import { render, screen } from "@testing-library/react";
import HomePage from "./page";

describe("HomePage", () => {
  it("renders the phase-1 workbench shell areas", () => {
    render(<HomePage />);

    expect(
      screen.getByRole("heading", {
        name: "AI 英文演讲实时字幕翻译助手"
      })
    ).toBeInTheDocument();
    expect(screen.getByText("输入源状态")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "开始模拟" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "暂停" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重置" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "生成总结" })).toBeInTheDocument();
    expect(screen.getByText("主字幕区")).toBeInTheDocument();
    expect(screen.getByText("会后总结")).toBeInTheDocument();
  });
});

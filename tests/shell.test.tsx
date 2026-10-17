import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import App from "@/App";

/**
 * The Phase 1 shell: the regions exist, are named for assistive tech, and the
 * one piece of behaviour that is real — the sidebar's section switch — works.
 */
describe("App shell", () => {
  beforeEach(() => {
    Reflect.deleteProperty(window, "astra");
  });

  it("renders every editor region", () => {
    render(<App />);

    expect(screen.getByRole("banner", { name: "Toolbar" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Sidebar" })).toBeInTheDocument();
    expect(screen.getByRole("main", { name: "Canvas" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Inspector" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Code editor" })).toBeInTheDocument();
    expect(screen.getByRole("contentinfo", { name: "Status bar" })).toBeInTheDocument();
  });

  it("brands the toolbar with the Astra logo and title", () => {
    const { container } = render(<App />);

    expect(screen.getByRole("heading", { name: "Astra" })).toBeInTheDocument();
    expect(container.querySelector("header img")).not.toBeNull();
  });

  it("shows inert toolbar controls rather than hiding them", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: /open project/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /open the sandboxed preview/i })).toBeDisabled();
  });

  it("switches sidebar sections and names each empty state", () => {
    render(<App />);

    expect(screen.getByText(/open a project folder to see its files here/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Components" }));
    expect(screen.getByRole("tab", { name: "Components" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText(/saved components will be listed here/i)).toBeInTheDocument();
  });

  it("prompts for a selection in the inspector and a file in the editor", () => {
    render(<App />);

    expect(screen.getByText(/select an element on the canvas/i)).toBeInTheDocument();
    expect(screen.getByText(/open a file to edit its source/i)).toBeInTheDocument();
    expect(screen.getByText(/open a project folder to begin/i)).toBeInTheDocument();
  });
});

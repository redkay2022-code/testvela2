import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { BrandSelect } from "@/components/brand-select";

Element.prototype.hasPointerCapture = () => false;
Element.prototype.setPointerCapture = () => {};
Element.prototype.releasePointerCapture = () => {};
Element.prototype.scrollIntoView = () => {};

function Harness({ id }: { id: string }) {
  const [value, setValue] = useState("");
  return <div>
    <BrandSelect id={id} value={value} onChange={setValue} />
    <p data-testid="saved">{value || "none"}</p>
  </div>;
}

const trigger = () => screen.getByLabelText("브랜드 선택");

function clickTrigger() {
  const node = trigger();
  fireEvent.pointerDown(node, { button: 0, ctrlKey: false, pointerType: "mouse", isPrimary: true });
  fireEvent.pointerUp(node, { button: 0, pointerType: "mouse", isPrimary: true });
  fireEvent.click(node);
}

const pickOption = (label: string) => fireEvent.click(screen.getAllByText(label, { selector: "span" })[0]);

describe("BrandSelect direct input", () => {
  it("re-opens the brand list after choosing Custom Input with empty text", () => {
    render(<Harness id="brand-empty" />);
    clickTrigger();
    pickOption("Custom Input (직접 입력)");
    expect(screen.getByLabelText("브랜드 직접 입력")).toHaveValue("");

    clickTrigger();

    expect(screen.getByText("TOP BRANDS")).toBeInTheDocument();
  });

  it("re-opens the brand list while a typed name is present and keeps the text", () => {
    render(<Harness id="brand-typed" />);
    clickTrigger();
    pickOption("Custom Input (직접 입력)");
    fireEvent.change(screen.getByLabelText("브랜드 직접 입력"), { target: { value: "Chanel" } });

    clickTrigger();

    expect(screen.getByText("TOP BRANDS")).toBeInTheDocument();
    expect(screen.getByTestId("saved")).toHaveTextContent("Chanel");
  });

  it("switches back and forth between a listed brand and Custom Input", () => {
    render(<Harness id="brand-switch" />);
    clickTrigger();
    pickOption("Custom Input (직접 입력)");
    fireEvent.change(screen.getByLabelText("브랜드 직접 입력"), { target: { value: "Chanel" } });

    clickTrigger();
    pickOption("ROLEX");
    expect(screen.getByTestId("saved")).toHaveTextContent("ROLEX");
    expect(screen.queryByLabelText("브랜드 직접 입력")).toBeNull();

    clickTrigger();
    pickOption("Custom Input (직접 입력)");
    expect(screen.getByLabelText("브랜드 직접 입력")).toBeInTheDocument();
  });
});

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

function pickCustomInput() {
  fireEvent.click(screen.getByText("Custom Input (직접 입력)", { selector: "span" }));
}

describe("BrandSelect direct input", () => {
  it("keeps the brand list closed while a typed brand name is present", () => {
    render(<Harness id="brand-typed" />);
    clickTrigger();
    pickCustomInput();
    const box = screen.getByLabelText("브랜드 직접 입력");
    fireEvent.change(box, { target: { value: "Chanel" } });
    expect(screen.getByTestId("saved")).toHaveTextContent("Chanel");

    clickTrigger();

    expect(screen.queryByText("TOP BRANDS")).toBeNull();
    expect(screen.getByLabelText("브랜드 직접 입력")).toHaveValue("Chanel");
  });

  it("reopens the brand list once the typed name is cleared", () => {
    render(<Harness id="brand-cleared" />);
    clickTrigger();
    pickCustomInput();
    const box = screen.getByLabelText("브랜드 직접 입력");
    fireEvent.change(box, { target: { value: "Chanel" } });
    fireEvent.change(box, { target: { value: "" } });

    clickTrigger();

    expect(screen.getByText("TOP BRANDS")).toBeInTheDocument();
  });
});

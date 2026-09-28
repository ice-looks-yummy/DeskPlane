import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Header } from "./Header";

afterEach(() => vi.useRealTimers());

describe("live local clock", () => {
  it("advances once per second independently of the aircraft timestamp", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 2, 12, 41, 1));
    const onRefresh = vi.fn();
    const receivedAt = 1_750_000_000_000;
    const { unmount } = render(<Header online={true} receivedAt={receivedAt} refreshing={false} onRefresh={onRefresh} />);
    const clock = screen.getByLabelText("Live local time");
    const startingValue = new Date().toLocaleTimeString(undefined, { hour12: false });
    expect(clock).toHaveTextContent(startingValue);
    expect(screen.getByText(new Date(receivedAt).toLocaleTimeString(undefined, { hour12: false }))).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1_000); });
    expect(clock).toHaveTextContent(new Date().toLocaleTimeString(undefined, { hour12: false }));
    expect(clock).not.toHaveTextContent(startingValue);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("makes the refresh control invoke its action and disables it while refreshing", () => {
    const onRefresh = vi.fn();
    const { rerender } = render(<Header online={true} receivedAt={null} refreshing={false} onRefresh={onRefresh} />);
    screen.getByRole("button", { name: "Refresh aircraft data" }).click();
    expect(onRefresh).toHaveBeenCalledOnce();
    rerender(<Header online={true} receivedAt={null} refreshing={true} onRefresh={onRefresh} />);
    expect(screen.getByRole("button", { name: "Refresh aircraft data" })).toBeDisabled();
  });
});

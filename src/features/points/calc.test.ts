import { describe, expect, it } from "bun:test";
import { balanceByUser, totalPoints } from "./calc";

describe("totalPoints", () => {
  it("jumlah semua transaksi termasuk negatif (koreksi)", () => {
    expect(totalPoints([{ amount: 10 }, { amount: -3 }, { amount: "5" }])).toBe(
      12,
    );
  });

  it("tanpa entri = 0", () => {
    expect(totalPoints([])).toBe(0);
  });

  it("amount string numerik ditangani", () => {
    expect(totalPoints([{ amount: "7.5" }])).toBe(7.5);
  });
});

describe("balanceByUser", () => {
  it("agregat per user", () => {
    const m = balanceByUser([
      { user_id: "a", amount: 10 },
      { user_id: "b", amount: 4 },
      { user_id: "a", amount: -2 },
    ]);
    expect(m.get("a")).toBe(8);
    expect(m.get("b")).toBe(4);
  });

  it("kompensasi = transaksi baru, saldo turun tanpa menghapus riwayat", () => {
    const m = balanceByUser([
      { user_id: "a", amount: 20 },
      { user_id: "a", amount: -20 },
    ]);
    expect(m.get("a")).toBe(0);
  });

  it("deterministik dari input sama", () => {
    const input = [
      { user_id: "x", amount: 1 },
      { user_id: "y", amount: 2 },
    ];
    expect([...balanceByUser(input).entries()]).toEqual([
      ...balanceByUser(input).entries(),
    ]);
  });
});

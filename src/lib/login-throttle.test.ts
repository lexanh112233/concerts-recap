import {createHash} from "node:crypto";
import {describe, expect, it} from "vitest";
import {clientKey, isLockedOut, MAX_FAILURES, retryMinutes, WINDOW_MS, type AttemptRecord} from "@/lib/login-throttle";

const NOW = new Date("2026-09-26T10:00:00.000Z");
const at = (ms: number) => new Date(NOW.getTime() + ms);
const record = (count: number, expiresInMs: number): AttemptRecord => ({count, expiresAt: at(expiresInMs)});
const headers = (values: Record<string, string>) => ({get: (name: string) => values[name.toLowerCase()] ?? null});

describe("giới hạn", () => {
    it("10 lần sai trong 15 phút", () => {
        expect(MAX_FAILURES).toBe(10);
        expect(WINDOW_MS).toBe(15 * 60 * 1000);
    });
});

describe("isLockedOut", () => {
    it("chưa có bản ghi thì không khoá", () => {
        expect(isLockedOut(null, NOW)).toBe(false);
    });

    it("đủ số lần sai và cửa sổ còn hiệu lực thì khoá; thiếu một lần thì chưa", () => {
        expect(isLockedOut(record(MAX_FAILURES, WINDOW_MS), NOW)).toBe(true);
        expect(isLockedOut(record(MAX_FAILURES + 5, 1000), NOW)).toBe(true);
        expect(isLockedOut(record(MAX_FAILURES - 1, WINDOW_MS), NOW)).toBe(false);
        expect(isLockedOut(record(0, WINDOW_MS), NOW)).toBe(false);
    });

    it("cửa sổ hết hạn (kể cả đúng mốc) thì mở khoá, dù bản ghi cũ còn nằm trong DB tới lượt quét TTL", () => {
        expect(isLockedOut(record(MAX_FAILURES, 1), NOW)).toBe(true);
        expect(isLockedOut(record(MAX_FAILURES, 0), NOW)).toBe(false);
        expect(isLockedOut(record(MAX_FAILURES, -60_000), NOW)).toBe(false);
    });
});

describe("retryMinutes", () => {
    it("làm tròn lên và tối thiểu 1 phút", () => {
        expect(retryMinutes(record(MAX_FAILURES, WINDOW_MS), NOW)).toBe(15);
        expect(retryMinutes(record(MAX_FAILURES, 14 * 60_000 + 1), NOW)).toBe(15);
        expect(retryMinutes(record(MAX_FAILURES, 60_000), NOW)).toBe(1);
        expect(retryMinutes(record(MAX_FAILURES, 1), NOW)).toBe(1);
        expect(retryMinutes(record(MAX_FAILURES, 0), NOW)).toBe(1);
    });
});

describe("clientKey", () => {
    it("là băm sha256 (64 ký tự hex), không chứa IP thô", () => {
        const key = clientKey(headers({"x-forwarded-for": "203.0.113.7"}));
        expect(key).toMatch(/^[0-9a-f]{64}$/);
        expect(key).not.toContain("203.0.113.7");
        expect(key).toBe(createHash("sha256").update("concerts-recap/login/203.0.113.7").digest("hex"));
    });

    it("lấy IP ĐẦU TIÊN trong x-forwarded-for (client thật), bỏ khoảng trắng", () => {
        const first = clientKey(headers({"x-forwarded-for": "203.0.113.7"}));
        expect(clientKey(headers({"x-forwarded-for": " 203.0.113.7 , 10.0.0.1, 10.0.0.2"}))).toBe(first);
    });

    it("hai IP khác nhau ra hai khoá khác nhau; cùng IP ra cùng khoá", () => {
        const a = clientKey(headers({"x-forwarded-for": "203.0.113.7"}));
        expect(clientKey(headers({"x-forwarded-for": "203.0.113.8"}))).not.toBe(a);
        expect(clientKey(headers({"x-forwarded-for": "203.0.113.7"}))).toBe(a);
    });

    it("thiếu x-forwarded-for thì dùng x-real-ip, thiếu cả hai thì gom vào một khoá chung", () => {
        expect(clientKey(headers({"x-real-ip": "198.51.100.2"}))).toBe(clientKey(headers({"x-forwarded-for": "198.51.100.2"})));
        expect(clientKey(headers({}))).toBe(clientKey(headers({"x-forwarded-for": "  "})));
        expect(clientKey(headers({}))).toBe(clientKey(headers({"x-forwarded-for": "unknown"})));
    });
});

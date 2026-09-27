import {describe, expect, it} from "vitest";
import {
    MAX_COST_ROWS,
    MAX_LABEL_LENGTH,
    netActualCost,
    netActualCostLabel,
    parseCostRows,
    sumCosts,
    toCostDocs,
} from "@/lib/costs";

const rowsJson = (rows: Array<{ label?: unknown, amount?: unknown }>) => JSON.stringify(rows);

describe("parseCostRows", () => {
    it("chuỗi rỗng hoặc JSON hỏng thì coi như không có dòng nào", () => {
        expect(parseCostRows("", "Chi phí")).toEqual({rows: []});
        expect(parseCostRows("không phải JSON", "Chi phí")).toEqual({rows: []});
        expect(parseCostRows("{}", "Chi phí")).toEqual({rows: []});
    });

    it("dòng để trống hoàn toàn (nhãn và số tiền đều rỗng) bị bỏ qua êm, không báo lỗi", () => {
        const {rows, error} = parseCostRows(rowsJson([{label: "", amount: ""}, {label: "  ", amount: "  "}]), "Chi phí");
        expect(rows).toEqual([]);
        expect(error).toBeUndefined();
    });

    it("chuẩn hoá số tiền hợp lệ và giữ nguyên nhãn", () => {
        const {rows, error} = parseCostRows(
            rowsJson([{label: "Taxi", amount: "150000"}, {label: "Grab", amount: "1.500.000đ"}]),
            "Chi phí",
        );
        expect(error).toBeUndefined();
        expect(rows).toEqual([{label: "Taxi", amount: "150000"}, {label: "Grab", amount: "1500000"}]);
    });

    it("có nhãn mà thiếu số tiền thì lỗi và giữ nguyên chữ đã gõ", () => {
        const {rows, error} = parseCostRows(rowsJson([{label: "Taxi", amount: ""}]), "Chi phí phát sinh");
        expect(rows).toEqual([{label: "Taxi", amount: ""}]);
        expect(error).toBe('Chi phí phát sinh — dòng "Taxi": cần cả nhãn và số tiền.');
    });

    it("có số tiền mà thiếu nhãn thì lỗi và giữ nguyên chữ đã gõ", () => {
        const {rows, error} = parseCostRows(rowsJson([{label: "", amount: "50000"}]), "Khoản thu hồi");
        expect(rows).toEqual([{label: "", amount: "50000"}]);
        expect(error).toBe('Khoản thu hồi — dòng "50000": cần cả nhãn và số tiền.');
    });

    it("số tiền không hợp lệ (không phải số, âm, quá lớn) thì báo lỗi và giữ nguyên chữ đã gõ", () => {
        const {rows, error} = parseCostRows(rowsJson([{label: "Vận chuyển", amount: "abc"}]), "Chi phí phát sinh");
        expect(rows).toEqual([{label: "Vận chuyển", amount: "abc"}]);
        expect(error).toBe('Chi phí phát sinh — dòng "Vận chuyển": số tiền phải từ 0 đến 100.000.000 (VND).');
    });

    it("dừng ở dòng sai đầu tiên, không xử lý các dòng sau", () => {
        const {rows, error} = parseCostRows(
            rowsJson([{label: "Taxi", amount: "50000"}, {label: "Grab", amount: ""}, {label: "Vận chuyển", amount: "10000"}]),
            "Chi phí",
        );
        expect(rows[0]).toEqual({label: "Taxi", amount: "50000"});
        expect(rows[1]).toEqual({label: "Grab", amount: ""});
        expect(error).toContain("Grab");
    });

    it(`quá ${MAX_COST_ROWS} dòng thì báo lỗi`, () => {
        const many = Array.from({length: MAX_COST_ROWS + 1}, (_, i) => ({label: `Dòng ${i}`, amount: "1000"}));
        const {error} = parseCostRows(rowsJson(many), "Chi phí");
        expect(error).toBe(`Chi phí: tối đa ${MAX_COST_ROWS} dòng.`);
    });

    it(`nhãn quá ${MAX_LABEL_LENGTH} ký tự thì báo lỗi`, () => {
        const long = "a".repeat(MAX_LABEL_LENGTH + 1);
        const {error} = parseCostRows(rowsJson([{label: long, amount: "1000"}]), "Chi phí");
        expect(error).toBe(`Chi phí — nhãn "${long}" tối đa ${MAX_LABEL_LENGTH} ký tự.`);
    });
});

describe("toCostDocs", () => {
    it("chuyển amount chuỗi (đã chuẩn hoá) thành số", () => {
        expect(toCostDocs([{label: "Taxi", amount: "150000"}, {label: "Grab", amount: "0"}])).toEqual([
            {label: "Taxi", amount: 150000},
            {label: "Grab", amount: 0},
        ]);
    });

    it("mảng rỗng thì trả mảng rỗng", () => {
        expect(toCostDocs([])).toEqual([]);
    });
});

describe("sumCosts", () => {
    it("cộng tổng amount", () => {
        expect(sumCosts([{label: "a", amount: 100}, {label: "b", amount: 250}])).toBe(350);
    });

    it.each([undefined, null, []])("undefined/null/mảng rỗng (%s) thì tổng là 0", (items) => {
        expect(sumCosts(items)).toBe(0);
    });
});

describe("netActualCost", () => {
    const extra = [{label: "Taxi", amount: 100_000}, {label: "Vận chuyển", amount: 50_000}];
    const merch = [{label: "Áo thun", amount: 80_000}];

    it("giá vé + chi phí phát sinh − khoản thu hồi", () => {
        expect(netActualCost(1_000_000, extra, merch)).toBe(1_070_000);
    });

    it("không có chi phí/merch thì thực chi bằng giá vé", () => {
        expect(netActualCost(1_000_000, undefined, undefined)).toBe(1_000_000);
        expect(netActualCost(1_000_000, [], [])).toBe(1_000_000);
    });

    it.each([null, undefined, Number.NaN])("chưa có giá vé (%s) thì trả null", (ticketPrice) => {
        expect(netActualCost(ticketPrice, extra, merch)).toBeNull();
    });

    it("thu hồi nhiều hơn tổng chi ra thì thực chi âm (lãi)", () => {
        expect(netActualCost(50_000, [], [{label: "Full set", amount: 200_000}])).toBe(-150_000);
    });
});

describe("netActualCostLabel", () => {
    it("null thì không hiện gì", () => {
        expect(netActualCostLabel(null)).toBeNull();
    });

    it("dương thì ghi Thực chi", () => {
        expect(netActualCostLabel(1_750_000)).toBe("Thực chi 1.750.000đ");
    });

    it("0 thì vẫn ghi Thực chi 0đ (không phải Miễn phí — đây là thực chi, không phải giá vé)", () => {
        expect(netActualCostLabel(0)).toBe("Thực chi 0đ");
    });

    it("âm thì ghi Lãi với trị tuyệt đối", () => {
        expect(netActualCostLabel(-150_000)).toBe("Lãi 150.000đ");
    });
});

describe("tiếng Anh (thông báo lỗi và nhãn thực chi)", () => {
    it("parseCostRows báo lỗi bằng tiếng Anh, dùng nhãn được truyền vào", () => {
        expect(parseCostRows(rowsJson([{label: "Taxi", amount: ""}]), "Extra costs", "en").error).toBe('Extra costs — line "Taxi": needs both a label and an amount.');
        expect(parseCostRows(rowsJson([{label: "", amount: "50000"}]), "Money back", "en").error).toBe('Money back — line "50000": needs both a label and an amount.');
        expect(parseCostRows(rowsJson([{label: "Bay", amount: "abc"}]), "Extra costs", "en").error).toBe('Extra costs — line "Bay": the amount must be from 0 to 100,000,000 (VND).');
        expect(parseCostRows(rowsJson(Array.from({length: MAX_COST_ROWS + 1}, () => ({label: "a", amount: "1"}))), "Extra costs", "en").error)
            .toBe(`Extra costs: at most ${MAX_COST_ROWS} lines.`);
        expect(parseCostRows(rowsJson([{label: "x".repeat(MAX_LABEL_LENGTH + 1), amount: "1"}]), "Extra costs", "en").error)
            .toContain(`can be at most ${MAX_LABEL_LENGTH} characters`);
    });

    it("mặc định vẫn là tiếng Việt", () => {
        expect(parseCostRows(rowsJson([{label: "Taxi", amount: ""}]), "Chi phí").error).toContain("cần cả nhãn và số tiền");
    });

    it("netActualCostLabel: tiếng Anh dùng dấu phẩy ngăn nghìn và chữ Net spent / Profit", () => {
        expect(netActualCostLabel(1_750_000, "en")).toBe("Net spent 1,750,000đ");
        expect(netActualCostLabel(-150_000, "en")).toBe("Profit 150,000đ");
        expect(netActualCostLabel(0, "en")).toBe("Net spent 0đ");
        expect(netActualCostLabel(null, "en")).toBeNull();
    });
});

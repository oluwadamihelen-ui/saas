/**
 * Pine Script v5 generator for the "RiskPilot Risk Box" indicator.
 * STRICTLY a risk visualisation: it draws the levels the USER types in and
 * computes risk / reward / position size. It has no entry logic and never
 * outputs buy or sell signals.
 */
export interface PineParams {
  accountSize: number;
  riskPercent: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  /** Money per 1.0 price-unit move per 1 lot, in account currency (e.g. XAUUSD with 100oz contract = 100). */
  valuePerPointPerLot: number;
  minLot: number;
  lotStep: number;
}

export const DEFAULT_PINE_PARAMS: PineParams = {
  accountSize: 1000,
  riskPercent: 1,
  entry: 2650,
  stopLoss: 2640,
  takeProfit: 2680,
  valuePerPointPerLot: 100,
  minLot: 0.01,
  lotStep: 0.01,
};

const n = (v: number) => (Number.isFinite(v) ? String(v) : "0");

export function buildPineScript(p: PineParams): string {
  return `//@version=5
// RiskPilot Risk Box — risk visualisation only.
// This indicator draws levels YOU enter. It does NOT generate buy/sell signals,
// does not predict the market, and is not financial advice.
// Position size depends on your broker's contract specification — always verify it.
indicator("RiskPilot Risk Box", overlay = true, max_boxes_count = 10, max_lines_count = 20, max_labels_count = 10)

grp1 = "Account"
accountSize = input.float(${n(p.accountSize)}, "Account size", minval = 0.01, group = grp1)
riskPct     = input.float(${n(p.riskPercent)}, "Risk %", minval = 0.01, maxval = 100, step = 0.1, group = grp1)

grp2 = "Trade plan (you type these in)"
entry = input.float(${n(p.entry)}, "Entry price", group = grp2)
stop  = input.float(${n(p.stopLoss)}, "Stop-loss price", group = grp2)
tp    = input.float(${n(p.takeProfit)}, "Take-profit price (0 = none)", group = grp2)

grp3 = "Broker contract specification (verify with your broker)"
valuePerPoint = input.float(${n(p.valuePerPointPerLot)}, "Money per 1.0 price move, per 1 lot", minval = 0.0000001, group = grp3)
minLot  = input.float(${n(p.minLot)}, "Minimum lot", minval = 0.0000001, group = grp3)
lotStep = input.float(${n(p.lotStep)}, "Lot step", minval = 0.0000001, group = grp3)

grp4 = "Display"
showZones = input.bool(true, "Show risk / reward zones", group = grp4)
showTable = input.bool(true, "Show info table", group = grp4)
extendBars = input.int(30, "Zone width (bars)", minval = 5, maxval = 200, group = grp4)

riskAmount   = accountSize * riskPct / 100
stopDist     = math.abs(entry - stop)
rawLots      = stopDist > 0 ? riskAmount / (stopDist * valuePerPoint) : 0.0
steps        = rawLots >= minLot ? math.floor((rawLots - minLot) / lotStep + 1e-7) : -1
lots         = steps >= 0 ? minLot + steps * lotStep : 0.0
actualRisk   = lots * stopDist * valuePerPoint
hasTp        = tp > 0 and tp != entry
rewardDist   = hasTp ? math.abs(tp - entry) : 0.0
rr           = stopDist > 0 and hasTp ? rewardDist / stopDist : na
potentialWin = lots * rewardDist * valuePerPoint
validInputs  = stopDist > 0

var box   riskBox   = na
var box   rewardBox = na
var line  entryLine = na
var line  stopLine  = na
var line  tpLine    = na

if barstate.islast and validInputs
    box.delete(riskBox)
    box.delete(rewardBox)
    line.delete(entryLine)
    line.delete(stopLine)
    line.delete(tpLine)
    left  = bar_index
    right = bar_index + extendBars
    if showZones
        riskBox := box.new(left, math.max(entry, stop), right, math.min(entry, stop), border_color = color.new(color.red, 60), bgcolor = color.new(color.red, 85))
        if hasTp
            rewardBox := box.new(left, math.max(entry, tp), right, math.min(entry, tp), border_color = color.new(color.green, 60), bgcolor = color.new(color.green, 88))
    entryLine := line.new(left, entry, right, entry, color = color.new(color.blue, 0), width = 2)
    stopLine  := line.new(left, stop, right, stop, color = color.new(color.red, 0), style = line.style_dashed)
    if hasTp
        tpLine := line.new(left, tp, right, tp, color = color.new(color.green, 0), style = line.style_dashed)

var table info = table.new(position.top_right, 2, 8, bgcolor = color.new(color.black, 20), border_width = 1)
if barstate.islast and showTable
    table.cell(info, 0, 0, "RiskPilot", text_color = color.white, text_halign = text.align_left)
    table.cell(info, 1, 0, "risk tool", text_color = color.gray)
    table.cell(info, 0, 1, "Risk amount", text_color = color.silver)
    table.cell(info, 1, 1, str.tostring(riskAmount, "#.##"), text_color = color.white)
    table.cell(info, 0, 2, "Risk % of account", text_color = color.silver)
    table.cell(info, 1, 2, str.tostring(accountSize > 0 ? actualRisk / accountSize * 100 : 0, "#.##") + "%", text_color = actualRisk / accountSize * 100 > 2 ? color.orange : color.white)
    table.cell(info, 0, 3, "Stop distance", text_color = color.silver)
    table.cell(info, 1, 3, str.tostring(stopDist, format.mintick), text_color = color.white)
    table.cell(info, 0, 4, "Position size (lots)", text_color = color.silver)
    table.cell(info, 1, 4, lots > 0 ? str.tostring(lots, "#.####") : "below min lot", text_color = lots > 0 ? color.white : color.orange)
    table.cell(info, 0, 5, "Potential loss", text_color = color.silver)
    table.cell(info, 1, 5, "-" + str.tostring(actualRisk, "#.##"), text_color = color.red)
    table.cell(info, 0, 6, "Potential profit", text_color = color.silver)
    table.cell(info, 1, 6, hasTp ? "+" + str.tostring(potentialWin, "#.##") : "-", text_color = color.green)
    table.cell(info, 0, 7, "Risk / reward", text_color = color.silver)
    table.cell(info, 1, 7, not na(rr) ? "1 : " + str.tostring(rr, "#.##") : "-", text_color = color.white)
`;
}

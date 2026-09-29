//+------------------------------------------------------------------+
//|                                               MarketCipherB.mq5  |
//|  MT5 port of the "MarketCipherB" TradingView indicator (© fumsy) |
//|  Original Pine Script licensed under MPL 2.0                     |
//|  https://mozilla.org/MPL/2.0/                                    |
//+------------------------------------------------------------------+
#property copyright "Port of MarketCipherB (© fumsy, MPL 2.0)"
#property version   "2.26"
#property description "Blue waves, VWAP, money flow, RSI/Stoch RSI and buy dots"
#property indicator_separate_window
#property indicator_buffers 18
#property indicator_plots   11

//--- 1: light blue wave (bw1)
#property indicator_label1  "Lt Blue Wave"
#property indicator_type1   DRAW_FILLING
#property indicator_color1  C'144,202,249',C'144,202,249'
//--- 2: blue wave (bw2)
#property indicator_label2  "Blue Wave"
#property indicator_type2   DRAW_FILLING
#property indicator_color2  C'13,71,161',C'13,71,161'
//--- 3: VWAP
#property indicator_label3  "VWAP"
#property indicator_type3   DRAW_FILLING
#property indicator_color3  C'150,140,25',C'150,140,25'
//--- 4: money flow (green above 0, red below)
#property indicator_label4  "Money Flow"
#property indicator_type4   DRAW_FILLING
#property indicator_color4  C'76,216,83',C'199,61,51'
//--- 5/6: money flow band at -90..-103
#property indicator_label5  "MF Band Green"
#property indicator_type5   DRAW_FILLING
#property indicator_color5  C'45,85,50',C'45,85,50'
#property indicator_label6  "MF Band Red"
#property indicator_type6   DRAW_FILLING
#property indicator_color6  C'100,42,38',C'100,42,38'
//--- 7: buy dot
#property indicator_label7  "Buy"
#property indicator_type7   DRAW_ARROW
#property indicator_color7  C'63,255,0'
#property indicator_width7  1
//--- 8/9: blue wave crossings
#property indicator_label8  "Blue Wave Crossing UP"
#property indicator_type8   DRAW_ARROW
#property indicator_color8  C'0,230,118'
#property indicator_width8  3
#property indicator_label9  "Blue Wave Crossing Down"
#property indicator_type9   DRAW_ARROW
#property indicator_color9  C'255,82,82'
#property indicator_width9  3
//--- 10: RSI
#property indicator_label10 "RSI"
#property indicator_type10  DRAW_LINE
#property indicator_color10 C'230,0,230'
#property indicator_width10 1
//--- 11: Stoch RSI (green when RSI > StochRSI, else red)
#property indicator_label11 "Sto RSI"
#property indicator_type11  DRAW_COLOR_LINE
#property indicator_color11 C'63,255,0',C'255,0,0'
#property indicator_width11 1

//--- inputs
input bool             InpUseCurrentTF = true;      // Use Current Chart Resolution?
input ENUM_TIMEFRAMES  InpCustomTF     = PERIOD_H1; // Custom resolution (if above is false)
input int              InpOBLevel      = 60;        // Over Bought Level 1
input int              InpTrigger1     = 53;        // Trigger 1
input int              InpOSLevel      = -60;       // Over Sold Level 1
input int              InpTrigger2     = -53;       // Trigger 2
input bool             InpNoRepaint    = true;      // Custom TF: use last closed bar for the forming bar
input int              InpMaxHTFBars   = 5000;      // Custom TF: max bars to load
input bool             InpAlertGreen   = false;     // Alert on Green Dot (buy)
input bool             InpAlertUp      = false;     // Alert on Blue Wave cross UP
input bool             InpAlertDown    = false;     // Alert on Blue Wave cross DOWN

//--- parameters (same as the Pine defaults)
#define BW_CHL_LEN   9
#define BW_AVG_LEN   12
#define MF_PERIOD    60
#define MF_MULT      200.0
#define MF_Y         2.25
#define RSI_LEN      40
#define STC_LEN      81
#define BUY_MARK_Y   -108.0

//--- plot buffers
double bBw1[], bBw1Z[];
double bBw2[], bBw2Z[];
double bVw[],  bVwZ[];
double bMf[],  bMfZ[];
double bGa[],  bGb[];
double bRa[],  bRb[];
double bBuy[], bUp[], bDn[];
double bRsi[], bStc[], bStcClr[];

//--- calculation state (chronological, index 0 = oldest)
double   g_esa[], g_d[], g_bw1[], g_bw2[], g_vwap[];
double   g_mfRaw[], g_mf[], g_st1[], g_st2[], g_rsi[], g_stc[];
datetime g_t[];
double   g_o[], g_h[], g_l[], g_c[];

bool            g_same = true;
ENUM_TIMEFRAMES g_tf   = PERIOD_CURRENT;
int             g_prevN = 0;
datetime        g_prevFirst = 0;
datetime        g_lastAlert = 0;

//+------------------------------------------------------------------+
int OnInit()
  {
   g_tf = InpUseCurrentTF ? (ENUM_TIMEFRAMES)_Period : InpCustomTF;
   if(g_tf == PERIOD_CURRENT)
      g_tf = (ENUM_TIMEFRAMES)_Period;
   if(PeriodSeconds(g_tf) < PeriodSeconds(PERIOD_CURRENT))
     {
      Print("MarketCipherB: custom timeframe is lower than chart timeframe, using chart timeframe");
      g_tf = (ENUM_TIMEFRAMES)_Period;
     }
   g_same = (g_tf == (ENUM_TIMEFRAMES)_Period);

   SetIndexBuffer(0,  bBw1,  INDICATOR_DATA);
   SetIndexBuffer(1,  bBw1Z, INDICATOR_DATA);
   SetIndexBuffer(2,  bBw2,  INDICATOR_DATA);
   SetIndexBuffer(3,  bBw2Z, INDICATOR_DATA);
   SetIndexBuffer(4,  bVw,   INDICATOR_DATA);
   SetIndexBuffer(5,  bVwZ,  INDICATOR_DATA);
   SetIndexBuffer(6,  bMf,   INDICATOR_DATA);
   SetIndexBuffer(7,  bMfZ,  INDICATOR_DATA);
   SetIndexBuffer(8,  bGa,   INDICATOR_DATA);
   SetIndexBuffer(9,  bGb,   INDICATOR_DATA);
   SetIndexBuffer(10, bRa,   INDICATOR_DATA);
   SetIndexBuffer(11, bRb,   INDICATOR_DATA);
   SetIndexBuffer(12, bBuy,  INDICATOR_DATA);
   SetIndexBuffer(13, bUp,   INDICATOR_DATA);
   SetIndexBuffer(14, bDn,   INDICATOR_DATA);
   SetIndexBuffer(15, bRsi,  INDICATOR_DATA);
   SetIndexBuffer(16, bStc,  INDICATOR_DATA);
   SetIndexBuffer(17, bStcClr, INDICATOR_COLOR_INDEX);

   for(int p = 0; p < 11; p++)
      PlotIndexSetDouble(p, PLOT_EMPTY_VALUE, EMPTY_VALUE);

   PlotIndexSetInteger(6, PLOT_ARROW, 159);   // small circle
   PlotIndexSetInteger(7, PLOT_ARROW, 159);
   PlotIndexSetInteger(8, PLOT_ARROW, 159);

   //--- horizontal levels: 0, 100, OB, OS, triggers
   IndicatorSetInteger(INDICATOR_LEVELS, 6);
   double lv[6];
   lv[0] = 0; lv[1] = 100; lv[2] = InpOBLevel; lv[3] = InpOSLevel;
   lv[4] = InpTrigger1; lv[5] = InpTrigger2;
   for(int i = 0; i < 6; i++)
     {
      IndicatorSetDouble(INDICATOR_LEVELVALUE, i, lv[i]);
      IndicatorSetInteger(INDICATOR_LEVELCOLOR, i, (i == 0) ? clrWhite : clrDimGray);
      IndicatorSetInteger(INDICATOR_LEVELSTYLE, i, STYLE_SOLID);
      IndicatorSetInteger(INDICATOR_LEVELWIDTH, i, 1);
     }

   IndicatorSetString(INDICATOR_SHORTNAME, "MarketCipherB");
   IndicatorSetInteger(INDICATOR_DIGITS, 2);

   g_prevN = 0;
   g_prevFirst = 0;
   g_lastAlert = 0;
   return(INIT_SUCCEEDED);
  }

//+------------------------------------------------------------------+
void ResizeState(const int n)
  {
   ArrayResize(g_esa, n);   ArrayResize(g_d, n);
   ArrayResize(g_bw1, n);   ArrayResize(g_bw2, n);   ArrayResize(g_vwap, n);
   ArrayResize(g_mfRaw, n); ArrayResize(g_mf, n);
   ArrayResize(g_st1, n);   ArrayResize(g_st2, n);
   ArrayResize(g_rsi, n);   ArrayResize(g_stc, n);
  }

//--- stochastic of close within [i-len+1, i] using high/low
double Stoch(const int i, const int len, const double &h[], const double &l[], const double &c[])
  {
   int    s  = MathMax(0, i - len + 1);
   double hh = h[s], ll = l[s];
   for(int k = s + 1; k <= i; k++)
     {
      if(h[k] > hh) hh = h[k];
      if(l[k] < ll) ll = l[k];
     }
   double rng = hh - ll;
   return (rng > 0.0) ? 100.0 * (c[i] - ll) / rng : 0.0;
  }

//--- moving average of arr over the last len values ending at i (partial window while warming up)
double SmaAt(const double &arr[], const int i, const int len)
  {
   int    s   = MathMax(0, i - len + 1);
   double sum = 0.0;
   for(int k = s; k <= i; k++)
      sum += arr[k];
   return sum / (i - s + 1);
  }

//--- incremental calculation of bars [from, n)
void Compute(const int from, const int n,
             const double &o[], const double &h[], const double &l[], const double &c[])
  {
   const double aChl = 2.0 / (BW_CHL_LEN + 1.0);
   const double aAvg = 2.0 / (BW_AVG_LEN + 1.0);

   for(int i = from; i < n; i++)
     {
      double src = (h[i] + l[i] + c[i]) / 3.0;

      if(i == 0)
        {
         g_esa[i] = src;
         g_d[i]   = 0.0;
        }
      else
        {
         g_esa[i] = aChl * src + (1.0 - aChl) * g_esa[i - 1];
         g_d[i]   = aChl * MathAbs(src - g_esa[i]) + (1.0 - aChl) * g_d[i - 1];
        }
      double ci = (g_d[i] > 0.0) ? (src - g_esa[i]) / (0.015 * g_d[i]) : 0.0;

      g_bw1[i] = (i == 0) ? ci : aAvg * ci + (1.0 - aAvg) * g_bw1[i - 1];
      g_bw2[i] = SmaAt(g_bw1, i, 3);
      g_vwap[i] = g_bw1[i] - g_bw2[i];

      double rng = h[i] - l[i];
      g_mfRaw[i] = (rng > 0.0) ? (c[i] - o[i]) / rng * MF_MULT : 0.0;
      g_mf[i]    = SmaAt(g_mfRaw, i, MF_PERIOD) - MF_Y;

      g_st1[i] = Stoch(i, RSI_LEN, h, l, c);
      g_st2[i] = Stoch(i, STC_LEN, h, l, c);
      g_rsi[i] = SmaAt(g_st1, i, 2);
      g_stc[i] = SmaAt(g_st2, i, 2);
     }
  }

//--- first index with a[i] > v
int UpperBound(const datetime &a[], const int n, const datetime v)
  {
   int lo = 0, hi = n;
   while(lo < hi)
     {
      int mid = (lo + hi) / 2;
      if(a[mid] <= v) lo = mid + 1; else hi = mid;
     }
   return lo;
  }

//--- first index with a[i] >= v
int LowerBound(const datetime &a[], const int n, const datetime v)
  {
   int lo = 0, hi = n;
   while(lo < hi)
     {
      int mid = (lo + hi) / 2;
      if(a[mid] < v) lo = mid + 1; else hi = mid;
     }
   return lo;
  }

//--- write chart bar i from calculation bar idx (idx < 0 -> empty)
void Publish(const int i, const int idx)
  {
   bBuy[i] = EMPTY_VALUE; bUp[i] = EMPTY_VALUE; bDn[i] = EMPTY_VALUE;

   if(idx < 0)
     {
      bBw1[i] = bBw1Z[i] = bBw2[i] = bBw2Z[i] = bVw[i] = bVwZ[i] = EMPTY_VALUE;
      bMf[i] = bMfZ[i] = bGa[i] = bGb[i] = bRa[i] = bRb[i] = EMPTY_VALUE;
      bRsi[i] = bStc[i] = EMPTY_VALUE;
      bStcClr[i] = 0;
      return;
     }

   bBw1[i] = g_bw1[idx];  bBw1Z[i] = 0.0;
   bBw2[i] = g_bw2[idx];  bBw2Z[i] = 0.0;
   bVw[i]  = g_vwap[idx]; bVwZ[i]  = 0.0;
   bMf[i]  = g_mf[idx];   bMfZ[i]  = 0.0;

   if(g_mf[idx] > 0.0)
     {
      bGa[i] = -90.0; bGb[i] = -103.0;
      bRa[i] = EMPTY_VALUE; bRb[i] = EMPTY_VALUE;
     }
   else
     {
      bRa[i] = -90.0; bRb[i] = -103.0;
      bGa[i] = EMPTY_VALUE; bGb[i] = EMPTY_VALUE;
     }

   bRsi[i]    = g_rsi[idx];
   bStc[i]    = g_stc[idx];
   bStcClr[i] = (g_rsi[idx] > g_stc[idx]) ? 0 : 1;
  }

//--- crossover / crossunder markers for chart bar i (needs i-1 already published)
void Signals(const int i)
  {
   if(i < 1 || bBw1[i] == EMPTY_VALUE || bBw1[i - 1] == EMPTY_VALUE)
      return;

   bool crossUp = (bBw1[i] > bBw2[i] && bBw1[i - 1] <= bBw2[i - 1]);
   bool crossDn = (bBw1[i] < bBw2[i] && bBw1[i - 1] >= bBw2[i - 1]);

   if(crossUp) bUp[i] = bBw2[i];
   if(crossDn) bDn[i] = bBw2[i];
   if(crossUp && bBw1[i] < InpOSLevel) bBuy[i] = BUY_MARK_Y;
  }

//+------------------------------------------------------------------+
int OnCalculate(const int rates_total,
                const int prev_calculated,
                const datetime &time[],
                const double &open[],
                const double &high[],
                const double &low[],
                const double &close[],
                const long &tick_volume[],
                const long &volume[],
                const int &spread[])
  {
   if(rates_total < 2)
      return(0);

   int start = 0;

   if(g_same)
     {
      ResizeState(rates_total);
      start = (prev_calculated > 0) ? prev_calculated - 1 : 0;
      Compute(start, rates_total, open, high, low, close);
      for(int i = start; i < rates_total; i++)
        {
         Publish(i, i);
         Signals(i);
        }
     }
   else
     {
      MqlRates r[];
      int got = CopyRates(_Symbol, g_tf, 0, MathMax(InpMaxHTFBars, 200), r);
      if(got <= 0)
         return(0);                       // data not ready yet, retry on next tick
      ArraySetAsSeries(r, false);

      bool full = (g_prevN == 0 || g_prevFirst != r[0].time || prev_calculated == 0);
      int  from = full ? 0 : MathMax(0, g_prevN - 1);

      ResizeState(got);
      ArrayResize(g_t, got); ArrayResize(g_o, got); ArrayResize(g_h, got);
      ArrayResize(g_l, got); ArrayResize(g_c, got);
      for(int k = 0; k < got; k++)
        {
         g_t[k] = r[k].time;  g_o[k] = r[k].open;
         g_h[k] = r[k].high;  g_l[k] = r[k].low;  g_c[k] = r[k].close;
        }
      Compute(from, got, g_o, g_h, g_l, g_c);

      if(full)
         start = 0;
      else
        {
         start = LowerBound(time, rates_total, g_t[MathMax(0, from - 1)]);
         start = MathMin(start, prev_calculated - 1);
        }

      for(int i = start; i < rates_total; i++)
        {
         int idx = UpperBound(g_t, got, time[i]) - 1;
         if(idx >= 0 && InpNoRepaint && idx == got - 1 && got > 1)
            idx--;                        // forming HTF bar -> use last closed one
         Publish(i, idx);
         Signals(i);
        }

      g_prevN     = got;
      g_prevFirst = r[0].time;
     }

   //--- alerts on the last closed chart bar
   int b = rates_total - 2;
   if(prev_calculated == 0)
      g_lastAlert = time[b];
   else if(time[b] != g_lastAlert)
     {
      g_lastAlert = time[b];
      if(InpAlertGreen && bBuy[b] != EMPTY_VALUE)
         Alert(_Symbol, " ", EnumToString((ENUM_TIMEFRAMES)_Period), ": MarketCipherB Green Dot");
      if(InpAlertUp && bUp[b] != EMPTY_VALUE)
         Alert(_Symbol, " ", EnumToString((ENUM_TIMEFRAMES)_Period), ": Blue Wave Crossing UP");
      if(InpAlertDown && bDn[b] != EMPTY_VALUE)
         Alert(_Symbol, " ", EnumToString((ENUM_TIMEFRAMES)_Period), ": Blue Wave Crossing Down");
     }

   return(rates_total);
  }
//+------------------------------------------------------------------+

//+------------------------------------------------------------------+
//|                                              WaveTrendCross.mq5  |
//|  WaveTrend part of MarketCipherB (© fumsy, MPL 2.0) — signals    |
//|  only when the light blue wave crosses the deep blue wave.       |
//|  https://mozilla.org/MPL/2.0/                                    |
//+------------------------------------------------------------------+
#property copyright "Port of MarketCipherB WaveTrend (© fumsy, MPL 2.0)"
#property version   "1.00"
#property description "Light blue wave (bw1) vs deep blue wave (bw2); dots only on crosses"
#property indicator_separate_window
#property indicator_buffers 6
#property indicator_plots   4

#property indicator_label1  "Lt Blue Wave"
#property indicator_type1   DRAW_LINE
#property indicator_color1  C'144,202,249'
#property indicator_width1  1

#property indicator_label2  "Blue Wave"
#property indicator_type2   DRAW_LINE
#property indicator_color2  C'30,100,230'
#property indicator_width2  2

#property indicator_label3  "Cross UP"
#property indicator_type3   DRAW_ARROW
#property indicator_color3  C'0,230,118'
#property indicator_width3  3

#property indicator_label4  "Cross DOWN"
#property indicator_type4   DRAW_ARROW
#property indicator_color4  C'255,82,82'
#property indicator_width4  3

input int  InpChannelLen  = 9;      // Channel length
input int  InpAverageLen  = 12;     // Average length
input int  InpOBLevel     = 60;     // Over Bought level
input int  InpOSLevel     = -60;    // Over Sold level
input bool InpZoneFilter  = false;  // Only signal in zones (UP below OS, DOWN above OB)
input bool InpAlerts      = false;  // Alert on cross

double bBw1[], bBw2[], bUp[], bDn[];
double cEsa[], cD[];

datetime g_lastAlert = 0;

//+------------------------------------------------------------------+
int OnInit()
  {
   SetIndexBuffer(0, bBw1, INDICATOR_DATA);
   SetIndexBuffer(1, bBw2, INDICATOR_DATA);
   SetIndexBuffer(2, bUp,  INDICATOR_DATA);
   SetIndexBuffer(3, bDn,  INDICATOR_DATA);
   SetIndexBuffer(4, cEsa, INDICATOR_CALCULATIONS);
   SetIndexBuffer(5, cD,   INDICATOR_CALCULATIONS);

   for(int p = 0; p < 4; p++)
      PlotIndexSetDouble(p, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   PlotIndexSetInteger(2, PLOT_ARROW, 159);   // small circle
   PlotIndexSetInteger(3, PLOT_ARROW, 159);

   IndicatorSetInteger(INDICATOR_LEVELS, 3);
   IndicatorSetDouble(INDICATOR_LEVELVALUE, 0, 0);
   IndicatorSetDouble(INDICATOR_LEVELVALUE, 1, InpOBLevel);
   IndicatorSetDouble(INDICATOR_LEVELVALUE, 2, InpOSLevel);
   for(int i = 0; i < 3; i++)
      IndicatorSetInteger(INDICATOR_LEVELCOLOR, i, clrDimGray);

   IndicatorSetString(INDICATOR_SHORTNAME, "WaveTrend Cross");
   IndicatorSetInteger(INDICATOR_DIGITS, 2);
   g_lastAlert = 0;
   return(INIT_SUCCEEDED);
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

   const double aChl = 2.0 / (InpChannelLen + 1.0);
   const double aAvg = 2.0 / (InpAverageLen + 1.0);
   int start = (prev_calculated > 0) ? prev_calculated - 1 : 0;

   for(int i = start; i < rates_total; i++)
     {
      double src = (high[i] + low[i] + close[i]) / 3.0;

      if(i == 0)
        {
         cEsa[i] = src;
         cD[i]   = 0.0;
        }
      else
        {
         cEsa[i] = aChl * src + (1.0 - aChl) * cEsa[i - 1];
         cD[i]   = aChl * MathAbs(src - cEsa[i]) + (1.0 - aChl) * cD[i - 1];
        }
      double ci = (cD[i] > 0.0) ? (src - cEsa[i]) / (0.015 * cD[i]) : 0.0;

      bBw1[i] = (i == 0) ? ci : aAvg * ci + (1.0 - aAvg) * bBw1[i - 1];

      int    s   = MathMax(0, i - 2);
      double sum = 0.0;
      for(int k = s; k <= i; k++)
         sum += bBw1[k];
      bBw2[i] = sum / (i - s + 1);

      bUp[i] = EMPTY_VALUE;
      bDn[i] = EMPTY_VALUE;
      if(i >= 1)
        {
         bool up = (bBw1[i] > bBw2[i] && bBw1[i - 1] <= bBw2[i - 1]);
         bool dn = (bBw1[i] < bBw2[i] && bBw1[i - 1] >= bBw2[i - 1]);
         if(InpZoneFilter)
           {
            up = up && bBw1[i] < InpOSLevel;
            dn = dn && bBw1[i] > InpOBLevel;
           }
         if(up) bUp[i] = bBw2[i];
         if(dn) bDn[i] = bBw2[i];
        }
     }

   //--- alerts on the last closed bar
   int b = rates_total - 2;
   if(prev_calculated == 0)
      g_lastAlert = time[b];
   else if(time[b] != g_lastAlert)
     {
      g_lastAlert = time[b];
      if(InpAlerts && bUp[b] != EMPTY_VALUE)
         Alert(_Symbol, " ", EnumToString((ENUM_TIMEFRAMES)_Period), ": WaveTrend cross UP");
      if(InpAlerts && bDn[b] != EMPTY_VALUE)
         Alert(_Symbol, " ", EnumToString((ENUM_TIMEFRAMES)_Period), ": WaveTrend cross DOWN");
     }

   return(rates_total);
  }
//+------------------------------------------------------------------+

/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import ReactECharts from 'echarts-for-react'
import { useEffect, useMemo, useState } from 'react'
import * as echarts from 'echarts'
import { getLocaleTag, t } from '@/src/lib/i18n'
import {
  DailyPlayHistoryItem,
  type DailyPlayHistoryItemData,
} from '@/src/components/tracks/DailyPlayHistoryItem'
import type { PlaybackTrack } from '@/src/components/tracks/playback.types'

const localeTag = getLocaleTag()
const MINUTE_MS = 60 * 1000
const HOUR_MS = 60 * MINUTE_MS
const DAYS_IN_WEEK = 7

type ViewMode = 'week' | 'month' | 'year'

type DailyActivityDatum = {
  date: string
  durationMs: number
  plays: DailyPlayHistoryItemData[]
}

type Props = {
  data: DailyActivityDatum[]
  variant?: 'standalone' | 'embedded'
  isPremium: boolean
  timeZone: string
  onOpenPlayback?: (track: PlaybackTrack) => void
}

type DailyIndex = {
  byDate: Map<string, DailyActivityDatum>
  earliestDate: Date | null
}

type ChartPoint = {
  key: string
  durationMs: number
  plays: DailyPlayHistoryItemData[]
  labelTop: string
  labelBottom?: string
  tooltipLabel: string
  dayKey?: string
  monthKey?: string
}

function parseChartDate(dateString: string): Date {
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(dateString) ? `${dateString}T00:00:00` : dateString
  return new Date(normalized)
}

function parsePlayedAtUtc(playedAt: string): Date {
  if (/[zZ]$|[+-]\d{2}:\d{2}$/.test(playedAt)) {
    return new Date(playedAt)
  }

  return new Date(`${playedAt}Z`)
}

function toLocalDateKey(date: Date): string {
  if (Number.isNaN(date.getTime())) return ''
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function toMonthKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

function parseMonthKey(monthKey: string): Date {
  const [yearRaw, monthRaw] = monthKey.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  }
  return new Date(year, month - 1, 1)
}

function addDays(baseDate: Date, days: number): Date {
  const result = new Date(baseDate)
  result.setDate(result.getDate() + days)
  return result
}

function startOfWeekMonday(date: Date): Date {
  const normalized = new Date(date)
  normalized.setHours(0, 0, 0, 0)
  const day = normalized.getDay()
  const diff = day === 0 ? 6 : day - 1
  normalized.setDate(normalized.getDate() - diff)
  return normalized
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function capitalizeLabel(label: string): string {
  if (label.length === 0) return label
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`
}

function formatDurationMs(durationMs: number): string {
  const totalMinutes = Math.max(0, Math.floor(durationMs / MINUTE_MS))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

function formatDayMonth(date: Date): string {
  return date.toLocaleDateString(localeTag, {
    day: 'numeric',
    month: 'short',
  })
}

function formatShortWeekday(date: Date): string {
  const weekday = date.toLocaleDateString(localeTag, { weekday: 'short' })
  return capitalizeLabel(weekday.replace('.', ''))
}

function formatLongDate(date: Date): string {
  return capitalizeLabel(
    date.toLocaleDateString(localeTag, {
      weekday: 'long',
      day: 'numeric',
      month: 'short',
    })
  )
}

function formatMonthTitle(date: Date): string {
  return capitalizeLabel(
    date.toLocaleDateString(localeTag, {
      month: 'long',
      year: 'numeric',
    })
  )
}

function formatMonthLabel(date: Date): string {
  return capitalizeLabel(date.toLocaleDateString(localeTag, { month: 'short' }).replace('.', ''))
}

function getYAxisInterval(maxDurationMs: number): number {
  if (maxDurationMs <= 45 * MINUTE_MS) return 15 * MINUTE_MS
  if (maxDurationMs <= 2 * HOUR_MS) return 30 * MINUTE_MS
  if (maxDurationMs <= 4 * HOUR_MS) return HOUR_MS
  if (maxDurationMs <= 8 * HOUR_MS) return 2 * HOUR_MS
  return 3 * HOUR_MS
}

function buildDailyIndex(data: DailyActivityDatum[]): DailyIndex {
  const byDate = new Map<string, DailyActivityDatum>()
  let earliestDate: Date | null = null

  for (const item of data) {
    const parsedDate = parseChartDate(item.date)
    if (Number.isNaN(parsedDate.getTime())) continue

    parsedDate.setHours(0, 0, 0, 0)
    if (!earliestDate || parsedDate.getTime() < earliestDate.getTime()) {
      earliestDate = new Date(parsedDate)
    }

    const dateKey = toLocalDateKey(parsedDate)
    if (!dateKey) continue

    const existing = byDate.get(dateKey)
    if (existing) {
      byDate.set(dateKey, {
        date: dateKey,
        durationMs: existing.durationMs + item.durationMs,
        plays: [...existing.plays, ...item.plays],
      })
      continue
    }

    byDate.set(dateKey, {
      date: dateKey,
      durationMs: item.durationMs,
      plays: [...item.plays],
    })
  }

  return { byDate, earliestDate }
}

function buildWeekPoints(weekStart: Date, byDate: Map<string, DailyActivityDatum>): ChartPoint[] {
  const points: ChartPoint[] = []

  for (let dayOffset = 0; dayOffset < DAYS_IN_WEEK; dayOffset += 1) {
    const date = addDays(weekStart, dayOffset)
    const dayKey = toLocalDateKey(date)
    const day = byDate.get(dayKey)
    points.push({
      key: dayKey,
      dayKey,
      durationMs: day?.durationMs ?? 0,
      plays: day?.plays ?? [],
      labelTop: formatShortWeekday(date),
      labelBottom: String(date.getDate()),
      tooltipLabel: formatLongDate(date),
    })
  }

  return points
}

function buildMonthPoints(monthStart: Date, byDate: Map<string, DailyActivityDatum>): ChartPoint[] {
  const points: ChartPoint[] = []
  const year = monthStart.getFullYear()
  const month = monthStart.getMonth()
  const totalDays = new Date(year, month + 1, 0).getDate()

  for (let dayNumber = 1; dayNumber <= totalDays; dayNumber += 1) {
    const date = new Date(year, month, dayNumber)
    const dayKey = toLocalDateKey(date)
    const day = byDate.get(dayKey)
    points.push({
      key: dayKey,
      dayKey,
      durationMs: day?.durationMs ?? 0,
      plays: day?.plays ?? [],
      labelTop: String(dayNumber),
      tooltipLabel: formatLongDate(date),
    })
  }

  return points
}

function buildYearPoints(year: number, byDate: Map<string, DailyActivityDatum>): ChartPoint[] {
  const totalsByMonth = new Map<string, number>()

  byDate.forEach((day) => {
    const parsedDate = parseChartDate(day.date)
    if (parsedDate.getFullYear() !== year) return
    const monthKey = toMonthKey(parsedDate)
    totalsByMonth.set(monthKey, (totalsByMonth.get(monthKey) ?? 0) + day.durationMs)
  })

  const points: ChartPoint[] = []
  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    const date = new Date(year, monthIndex, 1)
    const monthKey = toMonthKey(date)
    points.push({
      key: monthKey,
      monthKey,
      durationMs: totalsByMonth.get(monthKey) ?? 0,
      plays: [],
      labelTop: formatMonthLabel(date),
      tooltipLabel: capitalizeLabel(
        date.toLocaleDateString(localeTag, {
          month: 'long',
          year: 'numeric',
        })
      ),
    })
  }

  return points
}

function buildMonthGridDays(anchorMonth: Date): Date[] {
  const firstDayOfMonth = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth(), 1)
  const lastDayOfMonth = new Date(anchorMonth.getFullYear(), anchorMonth.getMonth() + 1, 0)
  const gridStart = startOfWeekMonday(firstDayOfMonth)
  const gridEnd = addDays(startOfWeekMonday(lastDayOfMonth), DAYS_IN_WEEK - 1)

  const days: Date[] = []
  const cursor = new Date(gridStart)
  while (cursor.getTime() <= gridEnd.getTime()) {
    days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return days
}

function sortPlaysByTime(plays: DailyPlayHistoryItemData[]): DailyPlayHistoryItemData[] {
  return [...plays].sort(
    (a, b) => parsePlayedAtUtc(a.playedAt).getTime() - parsePlayedAtUtc(b.playedAt).getTime()
  )
}

export default function DailyListeningChart({
  data,
  variant = 'standalone',
  isPremium,
  timeZone,
  onOpenPlayback,
}: Props) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < 640
  })
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const today = useMemo(() => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    return date
  }, [])
  const [anchorDateKey, setAnchorDateKey] = useState(() => toLocalDateKey(today))
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null)
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false)
  const [calendarMonthKey, setCalendarMonthKey] = useState(() => toMonthKey(today))

  const isEmbedded = variant === 'embedded'
  const resolvedTimeZone = timeZone && timeZone.trim().length > 0 ? timeZone : 'UTC'
  const anchorDate = useMemo(() => parseChartDate(anchorDateKey), [anchorDateKey])

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 640)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const { byDate, earliestDate } = useMemo(() => buildDailyIndex(data), [data])

  const earliestDay = earliestDate ?? today
  const currentWeekStart = useMemo(() => startOfWeekMonday(today), [today])
  const earliestWeekStart = useMemo(() => startOfWeekMonday(earliestDay), [earliestDay])
  const currentMonthStart = useMemo(() => startOfMonth(today), [today])
  const earliestMonthStart = useMemo(() => startOfMonth(earliestDay), [earliestDay])
  const currentYear = today.getFullYear()
  const earliestYear = earliestDay.getFullYear()

  const weekStart = useMemo(() => startOfWeekMonday(anchorDate), [anchorDate])
  const monthStart = useMemo(() => startOfMonth(anchorDate), [anchorDate])
  const year = anchorDate.getFullYear()

  const points = useMemo(() => {
    if (viewMode === 'week') return buildWeekPoints(weekStart, byDate)
    if (viewMode === 'month') return buildMonthPoints(monthStart, byDate)
    return buildYearPoints(year, byDate)
  }, [byDate, monthStart, viewMode, weekStart, year])

  const periodTitle = useMemo(() => {
    if (viewMode === 'week') return formatMonthTitle(weekStart)
    if (viewMode === 'month') return formatMonthTitle(monthStart)
    return String(year)
  }, [monthStart, viewMode, weekStart, year])

  const periodSubtitle = useMemo(() => {
    if (viewMode !== 'week') return null
    const weekEnd = addDays(weekStart, DAYS_IN_WEEK - 1)
    return `${formatDayMonth(weekStart)} - ${formatDayMonth(weekEnd)}`
  }, [viewMode, weekStart])

  const canGoPrev = useMemo(() => {
    if (viewMode === 'week') return weekStart.getTime() > earliestWeekStart.getTime()
    if (viewMode === 'month') return monthStart.getTime() > earliestMonthStart.getTime()
    return year > earliestYear
  }, [earliestMonthStart, earliestWeekStart, earliestYear, monthStart, viewMode, weekStart, year])

  const canGoNext = useMemo(() => {
    if (viewMode === 'week') return weekStart.getTime() < currentWeekStart.getTime()
    if (viewMode === 'month') return monthStart.getTime() < currentMonthStart.getTime()
    return year < currentYear
  }, [currentMonthStart, currentWeekStart, currentYear, monthStart, viewMode, weekStart, year])

  const playableDayKeys = useMemo(() => {
    const keys = new Set<string>()
    byDate.forEach((day, key) => {
      if (day.plays.length > 0) keys.add(key)
    })
    return keys
  }, [byDate])

  const selectedPoint = useMemo(() => {
    if (!selectedDayKey || viewMode === 'year') return null
    return points.find((point) => point.dayKey === selectedDayKey) ?? null
  }, [points, selectedDayKey, viewMode])

  const selectedDayPlays = useMemo(
    () => (selectedPoint ? sortPlaysByTime(selectedPoint.plays) : []),
    [selectedPoint]
  )

  const pointByKey = useMemo(() => {
    const entries = points.map((point) => [point.key, point] as const)
    return new Map(entries)
  }, [points])

  const option = useMemo(() => {
    const xAxisData = points.map((point) => point.key)
    const baseBarGradient = new echarts.graphic.LinearGradient(0, 0, 0, 1, [
      { offset: 0, color: '#1ee9b0' },
      { offset: 0.55, color: '#18cfa1' },
      { offset: 1, color: '#0e7d85' },
    ])

    const maxDurationMs = Math.max(...points.map((point) => point.durationMs), 0)
    const axisInterval = getYAxisInterval(maxDurationMs)
    const yAxisMax = Math.max(axisInterval * 2, Math.ceil(maxDurationMs / axisInterval) * axisInterval)

    const tooltip = {
      trigger: 'item',
      backgroundColor: 'rgba(8, 20, 24, 0.96)',
      borderColor: '#1dd6a7',
      borderWidth: 1,
      textStyle: {
        color: '#e6f3f1',
        fontSize: 12,
      },
      formatter: (params: any) => {
        if (typeof params?.dataIndex !== 'number') return ''

        const point = points[params.dataIndex]
        const rawValue = params?.value
        const value = typeof rawValue === 'number' ? rawValue : (rawValue?.value ?? point?.durationMs ?? 0)
        const label = point?.tooltipLabel ?? params?.name ?? ''

        return `<div style="padding: 10px; min-width: 150px;">
          <div style="font-size: 11px; color: #9cc9c4; margin-bottom: 4px;">${label}</div>
          <div style="font-size: 18px; font-weight: 700; color: #dff7f2;">${formatDurationMs(value)}</div>
        </div>`
      },
    }

    return {
      tooltip,
      grid: {
        left: isMobile ? '44px' : '58px',
        right: isMobile ? '10px' : '22px',
        top: isMobile ? '12px' : '16px',
        bottom: viewMode === 'week' ? (isMobile ? '52px' : '56px') : isMobile ? '34px' : '36px',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: xAxisData,
        axisTick: {
          alignWithLabel: true,
        },
        axisLabel: {
          interval: viewMode === 'month' ? (isMobile ? 2 : 1) : 0,
          lineHeight: viewMode === 'week' ? (isMobile ? 15 : 18) : 14,
          formatter: (value: string) => {
            const point = pointByKey.get(value)
            if (!point) return value

            if (point.labelBottom) {
              return `{top|${point.labelTop}}\n{bottom|${point.labelBottom}}`
            }

            return `{single|${point.labelTop}}`
          },
          rich: {
            top: {
              color: '#8db0ad',
              fontSize: isMobile ? 10 : 11,
              fontWeight: 600,
            },
            bottom: {
              color: '#d9f4ec',
              fontSize: isMobile ? 12 : 13,
              fontWeight: 700,
            },
            single: {
              color: '#cbe9e1',
              fontSize: isMobile ? 10 : 11,
              fontWeight: 600,
            },
          },
        },
        axisLine: {
          lineStyle: {
            color: '#1f3b40',
          },
        },
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: yAxisMax,
        interval: axisInterval,
        axisLabel: {
          formatter: (value: number) => formatDurationMs(value),
          color: '#8db0ad',
          fontSize: isMobile ? 10 : 11,
        },
        axisLine: {
          show: false,
        },
        splitLine: {
          lineStyle: {
            color: '#1c3236',
            type: 'dashed',
          },
        },
      },
      series: [
        {
          data: points.map((point) => point.durationMs),
          type: 'bar',
          barWidth: viewMode === 'year' ? (isMobile ? '52%' : '58%') : isMobile ? '44%' : '52%',
          showBackground: true,
          backgroundStyle: {
            color: 'rgba(17, 43, 52, 0.42)',
            borderRadius: [9, 9, 0, 0],
          },
          itemStyle: {
            color: baseBarGradient,
            borderRadius: [9, 9, 0, 0],
          },
          emphasis: {
            itemStyle: {
              color: '#4ef3c1',
            },
          },
          label: {
            show: false,
          },
        },
      ],
      animationDuration: 500,
      animationEasing: 'quarticOut',
    }
  }, [isMobile, pointByKey, points, viewMode])

  const onChartEvents = useMemo(
    () => ({
      click: (params: any) => {
        if (params?.componentType !== 'series') return
        if (typeof params?.dataIndex !== 'number') return

        const point = points[params.dataIndex]
        if (!point) return

        if (viewMode === 'year' && point.monthKey) {
          setViewMode('month')
          setAnchorDateKey(`${point.monthKey}-01`)
          setSelectedDayKey(null)
          return
        }

        if (!point.dayKey) return
        setSelectedDayKey(point.dayKey)
      },
    }),
    [points, viewMode]
  )

  const height = isMobile ? (isEmbedded ? '250px' : '290px') : isEmbedded ? '300px' : '360px'

  const shiftPeriod = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && !canGoPrev) return
    if (direction === 'next' && !canGoNext) return

    if (viewMode === 'week') {
      const base = startOfWeekMonday(anchorDate)
      const next = addDays(base, direction === 'next' ? DAYS_IN_WEEK : -DAYS_IN_WEEK)
      setAnchorDateKey(toLocalDateKey(next))
      setCalendarMonthKey(toMonthKey(next))
      setSelectedDayKey(null)
      return
    }

    if (viewMode === 'month') {
      const base = startOfMonth(anchorDate)
      const next = new Date(base.getFullYear(), base.getMonth() + (direction === 'next' ? 1 : -1), 1)
      setAnchorDateKey(toLocalDateKey(next))
      setCalendarMonthKey(toMonthKey(next))
      setSelectedDayKey(null)
      return
    }

    const next = new Date(year + (direction === 'next' ? 1 : -1), 0, 1)
    setAnchorDateKey(toLocalDateKey(next))
    setCalendarMonthKey(toMonthKey(next))
    setSelectedDayKey(null)
  }

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    if (mode === 'year') {
      setSelectedDayKey(null)
    }
  }

  const toggleDatePicker = () => {
    if (!isDatePickerOpen) {
      const baseDate = selectedDayKey ? parseChartDate(selectedDayKey) : anchorDate
      setCalendarMonthKey(toMonthKey(baseDate))
    }
    setIsDatePickerOpen((current) => !current)
  }

  const handleCalendarMonthMove = (direction: 'prev' | 'next') => {
    const monthAnchor = parseMonthKey(calendarMonthKey)
    const moved = new Date(
      monthAnchor.getFullYear(),
      monthAnchor.getMonth() + (direction === 'next' ? 1 : -1),
      1
    )
    setCalendarMonthKey(toMonthKey(moved))
  }

  const handleDatePick = (date: Date) => {
    const dateKey = toLocalDateKey(date)
    if (!playableDayKeys.has(dateKey)) return

    setViewMode('week')
    setAnchorDateKey(dateKey)
    setSelectedDayKey(dateKey)
    setCalendarMonthKey(toMonthKey(date))
    setIsDatePickerOpen(false)
  }

  const anchorMonth = useMemo(() => parseMonthKey(calendarMonthKey), [calendarMonthKey])
  const monthGridDays = useMemo(() => buildMonthGridDays(anchorMonth), [anchorMonth])

  return (
    <div
      className={
        isEmbedded
          ? 'w-full'
          : 'w-screen sm:w-full max-w-none sm:max-w-full relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] sm:left-auto sm:right-auto sm:ml-0 sm:mr-0 rounded-none sm:rounded-lg bg-[#0b1820] p-4 sm:p-6 border-0 sm:border border-[#1b3a40] shadow-lg shadow-emerald-500/5'
      }
    >
      {!isEmbedded ? <h2 className="mb-4 text-lg font-semibold text-[#dff7f2]">{t('chart.dailyListeningTitle')}</h2> : null}
      <div
        className={
          isEmbedded
            ? 'rounded-2xl border border-[#16313a] bg-linear-to-br from-[#0e1f28] to-[#0b1820] p-3'
            : 'rounded-none sm:rounded-lg border-0 sm:border border-[#16313a] bg-linear-to-br from-[#0e1f28] to-[#0b1820] p-3 sm:p-4'
        }
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="inline-flex rounded-lg border border-[#254851] bg-[#0e222c] p-1">
            {([
              ['week', t('chart.viewWeek')],
              ['month', t('chart.viewMonth')],
              ['year', t('chart.viewYear')],
            ] as const).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => handleViewModeChange(mode)}
                className={`rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                  viewMode === mode
                    ? 'bg-[#1f3f49] text-white'
                    : 'text-[#9cc9c4] hover:text-[#dff7f2]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="min-w-0 text-center">
            <p className="truncate text-sm font-semibold text-[#e6f3f1]">{periodTitle}</p>
            {periodSubtitle ? <p className="truncate text-xs text-slate-400">{periodSubtitle}</p> : null}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => shiftPeriod('prev')}
              disabled={!canGoPrev}
              aria-label={t('chart.previousPeriod')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#2d5560] bg-[#102631] text-[#9cd7ca] transition-colors hover:border-[#31a78a] hover:text-[#dff7f2] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                <path
                  d="M12.5 4.5L7 10l5.5 5.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => shiftPeriod('next')}
              disabled={!canGoNext}
              aria-label={t('chart.nextPeriod')}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#2d5560] bg-[#102631] text-[#9cd7ca] transition-colors hover:border-[#31a78a] hover:text-[#dff7f2] disabled:cursor-not-allowed disabled:opacity-35"
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                <path
                  d="M7.5 4.5L13 10l-5.5 5.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={toggleDatePicker}
            className="inline-flex items-center gap-2 rounded-full border border-[#2d5560] bg-[#102631] px-3 py-1.5 text-xs font-semibold text-[#cdebe4] transition-colors hover:border-[#31a78a] hover:text-white"
          >
            {isDatePickerOpen ? t('chart.closeDatepicker') : t('chart.openDatepicker')}
          </button>
        </div>

        {isDatePickerOpen ? (
          <section className="mb-3 rounded-2xl border border-[#1b3a40] bg-[#0a1922]/85 p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#ddf5ef]">{t('chart.datepickerTitle')}</h3>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleCalendarMonthMove('prev')}
                  aria-label={t('chart.previousMonth')}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#2d5560] bg-[#102631] text-[#9cd7ca] transition-colors hover:border-[#31a78a] hover:text-[#dff7f2]"
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                    <path
                      d="M12.5 4.5L7 10l5.5 5.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <span className="min-w-[140px] text-center text-xs font-semibold uppercase tracking-[0.14em] text-[#8fc6ba]">
                  {formatMonthTitle(anchorMonth)}
                </span>
                <button
                  type="button"
                  onClick={() => handleCalendarMonthMove('next')}
                  aria-label={t('chart.nextMonth')}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#2d5560] bg-[#102631] text-[#9cd7ca] transition-colors hover:border-[#31a78a] hover:text-[#dff7f2]"
                >
                  <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
                    <path
                      d="M7.5 4.5L13 10l-5.5 5.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] text-slate-400">
              {Array.from({ length: 7 }).map((_, index) => {
                const day = addDays(startOfWeekMonday(new Date()), index)
                return (
                  <span key={index} className="pb-1 font-semibold uppercase tracking-wide">
                    {formatShortWeekday(day)}
                  </span>
                )
              })}
              {monthGridDays.map((day) => {
                const dayKey = toLocalDateKey(day)
                const isCurrentMonth =
                  day.getMonth() === anchorMonth.getMonth() && day.getFullYear() === anchorMonth.getFullYear()
                const hasPlays = playableDayKeys.has(dayKey)
                const isSelected = selectedDayKey === dayKey
                const canPick = isCurrentMonth && hasPlays

                return (
                  <button
                    key={dayKey}
                    type="button"
                    onClick={() => handleDatePick(day)}
                    disabled={!canPick}
                    className={`h-9 rounded-lg border text-sm font-semibold transition-colors ${
                      isSelected
                        ? 'border-[#54d0af] bg-[#1a3a44] text-white'
                        : canPick
                          ? 'border-[#295058] bg-[#0f2530] text-[#d8f4ec] hover:border-[#3f9b84] hover:text-white'
                          : 'border-[#1c3338] bg-[#0c1f29] text-[#4f6669] opacity-60'
                    }`}
                  >
                    {day.getDate()}
                  </button>
                )
              })}
            </div>
            <p className="mt-3 text-xs text-slate-400">{t('chart.datepickerHint')}</p>
          </section>
        ) : null}

        <ReactECharts
          key={`${isMobile ? 'mobile' : 'desktop'}-${variant}-${viewMode}-${anchorDateKey}`}
          option={option}
          notMerge={true}
          lazyUpdate={true}
          onEvents={onChartEvents}
          style={{ height, width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />

        {selectedPoint ? (
          <section className="mt-4 rounded-2xl border border-[#1b3a40] bg-[#0a1922]/85 p-3 sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-[#ddf5ef]">{t('chart.timelineTitle')}</h3>
              <span className="text-xs text-slate-400">{selectedPoint.tooltipLabel}</span>
            </div>

            {selectedDayPlays.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[#23464d] bg-[#0d202b]/70 px-3 py-4 text-sm text-slate-400">
                {t('chart.timelineNoPlays')}
              </p>
            ) : (
              <div className="max-h-[320px] space-y-2 overflow-y-auto pr-1">
                {selectedDayPlays.map((play, index) => (
                  <DailyPlayHistoryItem
                    key={`${play.trackId}-${play.playedAt}-${index}`}
                    play={play}
                    isPremium={isPremium}
                    timeZone={resolvedTimeZone}
                    onPlay={onOpenPlayback}
                  />
                ))}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  )
}

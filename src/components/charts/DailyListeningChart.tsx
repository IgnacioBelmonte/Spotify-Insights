/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import ReactECharts from 'echarts-for-react'
import { useEffect, useMemo, useState } from 'react'
import * as echarts from 'echarts'
import { getLocaleTag, t } from '@/src/lib/i18n'

const localeTag = getLocaleTag()

type Props = {
  data: { date: string; durationMs: number; plays: { trackId: string; name: string; artistName: string; playedAt: string }[] }[]
  variant?: "standalone" | "embedded"
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }
  return date.toLocaleDateString(localeTag, options).toUpperCase()
}

function formatDateMobile(dateString: string): string {
  const date = new Date(dateString)
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }
  return date.toLocaleDateString(localeTag, options).toUpperCase()
}

function formatDurationMs(durationMs: number): string {
  const totalMinutes = Math.floor(durationMs / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  
  if (hours === 0) {
    return `${mins}m`
  }
  if (mins === 0) {
    return `${hours}h`
  }
  return `${hours}h ${mins}m`
}

function formatTime24(playedAt: string): string {
  const date = new Date(playedAt)
  return date.toLocaleTimeString(localeTag, {
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function DailyListeningChart({ data, variant = "standalone" }: Props) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.innerWidth < 640
  })
  const isEmbedded = variant === "embedded"

  useEffect(() => {
    const update = () => setIsMobile(window.innerWidth < 640)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  const option = useMemo(() => {
    const xAxisData = data.map((item) => (isMobile ? formatDateMobile(item.date) : formatDate(item.date)))
    const seriesData = data.map((item) => item.durationMs)

    const tooltipBase = {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow',
        },
        backgroundColor: 'rgba(8, 20, 24, 0.95)',
        borderColor: '#1dd6a7',
        borderWidth: 1,
        textStyle: {
          color: '#e6f3f1',
          fontSize: 12,
        },
        extraCssText: 'max-width: 280px; overflow: hidden;',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (params: any) => {
          if (Array.isArray(params) && params.length > 0) {
            const value = params[0].value
            const name = params[0].name
            const dataIndex = params[0].dataIndex as number
            const dayPlays = data[dataIndex]?.plays ?? []
            const sortedPlays = [...dayPlays].sort(
              (a, b) => new Date(a.playedAt).getTime() - new Date(b.playedAt).getTime()
            )
            const playsHtml = sortedPlays.length
              ? `<div style="margin-top: 8px; color: #d8f4ec; max-width: 240px;">
                   ${sortedPlays
                     .map((play) => {
                       const time = formatTime24(play.playedAt)
                       return `<div style="white-space: normal; word-break: break-word; line-height: 1.25;">• ${time} — ${play.name} <span style="color:#9cc9c4">(${play.artistName})</span></div>`
                     })
                     .join("")}
                 </div>`
              : `<div style="margin-top: 8px; color: #8db0ad;">${t("chart.noPlays")}</div>`
            return `<div style="padding: 10px;">
              <div style="font-weight: bold; margin-bottom: 6px; color: #9ef3d4;">${name}</div>
              <div style="color: #d8f4ec;">⏱️ ${formatDurationMs(value)}</div>
              ${playsHtml}
            </div>`
          }
          return ''
        },
      }

    const tooltip = isMobile
      ? {
          ...tooltipBase,
          position: (pos: number[], _params: unknown, _dom: unknown, _rect: unknown, size: any) => {
            const viewWidth = size?.viewSize?.[0] ?? 0
            const viewHeight = size?.viewSize?.[1] ?? 0
            const boxWidth = size?.contentSize?.[0] ?? 0
            const boxHeight = size?.contentSize?.[1] ?? 0
            const x = Math.max(8, (viewWidth - boxWidth) / 2)
            const y = Math.max(8, (viewHeight - boxHeight) / 2)
            return [x, y]
          },
        }
      : tooltipBase

    return {
      tooltip,
      grid: {
        left: isMobile ? '40px' : '60px',
        right: isMobile ? '12px' : '30px',
        top: isMobile ? '20px' : '30px',
        bottom: isMobile ? '90px' : '80px',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: xAxisData,
        axisLabel: {
          interval: isMobile ? 'auto' : 0,
          rotate: isMobile ? 55 : 0,
          fontSize: isMobile ? 10 : 12,
          color: '#8db0ad',
        },
        axisLine: {
          lineStyle: {
            color: '#1f3b40',
          },
        },
        splitLine: {
          show: false,
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (value: number) => `${(value / 3600000).toFixed(1)}h`,
          color: '#8db0ad',
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
          data: seriesData,
          type: 'bar',
          itemStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#14f1b2' },
              { offset: 0.55, color: '#1dd6a7' },
              { offset: 1, color: '#0a6f77' },
            ]),
            borderRadius: [12, 12, 0, 0],
            shadowColor: 'rgba(20, 241, 178, 0.25)',
            shadowBlur: 10,
            shadowOffsetY: 5,
          },
          emphasis: {
            itemStyle: {
              color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#f8c64a' },
                { offset: 0.6, color: '#ffd77d' },
                { offset: 1, color: '#1dd6a7' },
              ]),
              shadowColor: 'rgba(248, 198, 74, 0.35)',
              shadowBlur: 15,
              shadowOffsetY: 8,
            },
          },
          label: {
            show: !isMobile,
            position: 'top',
            formatter: (params: any) => formatDurationMs(params.value),
            color: '#9cc9c4',
            fontSize: 11,
            fontWeight: 500,
          },
        },
      ],
      animationDuration: 1000,
      animationEasing: 'cubicOut',
    }
  }, [data, isMobile])

  const height = isMobile ? (isEmbedded ? "300px" : "320px") : (isEmbedded ? "380px" : "450px")

  return (
    <div
      className={
        isEmbedded
          ? "w-full"
          : "w-screen sm:w-full max-w-none sm:max-w-full relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw] sm:left-auto sm:right-auto sm:ml-0 sm:mr-0 rounded-none sm:rounded-lg bg-[#0b1820] p-4 sm:p-6 border-0 sm:border border-[#1b3a40] shadow-lg shadow-emerald-500/5"
      }
    >
      {!isEmbedded ? (
        <h2 className="mb-4 text-lg font-semibold text-[#dff7f2]">{t("chart.dailyListeningTitle")}</h2>
      ) : null}
      <div
        className={
          isEmbedded
            ? "rounded-2xl border border-[#16313a] bg-linear-to-br from-[#0e1f28] to-[#0b1820] p-3"
            : "rounded-none sm:rounded-lg border-0 sm:border border-[#16313a] bg-linear-to-br from-[#0e1f28] to-[#0b1820] p-3 sm:p-4"
        }
      >
        <ReactECharts
          key={`${isMobile ? 'mobile' : 'desktop'}-${variant}`}
          option={option}
          notMerge={true}
          lazyUpdate={true}
          style={{ height, width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
      </div>
    </div>
  )
}

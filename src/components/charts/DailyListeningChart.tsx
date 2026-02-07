'use client'

import ReactECharts from 'echarts-for-react'
import { useEffect, useMemo } from 'react'
import * as echarts from 'echarts'

type Props = {
    data: { date: string; durationMs: number; tracks: { trackId: string; name: string; artistName: string; playCount: number }[] }[]
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const options: Intl.DateTimeFormatOptions = {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }
  return date.toLocaleDateString('es-ES', options).toUpperCase()
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

export default function DailyListeningChart({ data }: Props) {
  useEffect(() => {
    console.log("DailyListeningChart props:", { data })
  }, [data])

  const option = useMemo(() => {
    const xAxisData = data.map((item) => formatDate(item.date))
    const seriesData = data.map((item) => item.durationMs)

    return {
      tooltip: {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        formatter: (params: any) => {
          if (Array.isArray(params) && params.length > 0) {
            const value = params[0].value
            const name = params[0].name
            const dataIndex = params[0].dataIndex as number
            const dayTracks = data[dataIndex]?.tracks ?? []
            const tracksHtml = dayTracks.length
              ? `<div style="margin-top: 8px; color: #d8f4ec;">
                   ${dayTracks
                     .map(
                       (track) =>
                         `<div>• ${track.name} <span style="color:#9cc9c4">— ${track.artistName} (${track.playCount})</span></div>`
                     )
                     .join("")}
                 </div>`
              : `<div style="margin-top: 8px; color: #8db0ad;">Sin canciones</div>`
            return `<div style="padding: 10px;">
              <div style="font-weight: bold; margin-bottom: 6px; color: #9ef3d4;">${name}</div>
              <div style="color: #d8f4ec;">⏱️ ${formatDurationMs(value)}</div>
              ${tracksHtml}
            </div>`
          }
          return ''
        },
      },
      grid: {
        left: '60px',
        right: '30px',
        top: '30px',
        bottom: '80px',
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: xAxisData,
        axisLabel: {
          interval: 0,
          rotate: 0,
          fontSize: 12,
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
            show: true,
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
  }, [data])

  return (
    <div className="w-full rounded-lg bg-[#0b1820] p-6 border border-[#1b3a40] shadow-lg shadow-emerald-500/5">
      <h2 className="mb-4 text-lg font-semibold text-[#dff7f2]">Actividad de Escucha Diaria</h2>
      <div className="rounded-lg border border-[#16313a] bg-gradient-to-br from-[#0e1f28] to-[#0b1820] p-4">
        <ReactECharts 
          option={option} 
          style={{ height: '450px', width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
      </div>
    </div>
  )
}

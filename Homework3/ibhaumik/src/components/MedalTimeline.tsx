import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useResizeObserver, useDebounceCallback } from 'usehooks-ts';
import { ComponentSize, Margin } from '../types';

const TRANSITION_DURATION = 400;

interface MedalRow {
  medal_type: string;
  medal_date: string;
  country_code: string;
  discipline: string;
}

interface MedalTimelineProps {
  selectedCountryCode: string;
  selectedCountryName: string;
  selectedDiscipline?: string | null;
}

interface MedalByDate {
  date: Date;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
}

const medalColors: Record<string, string> = {
  gold: '#d4af37',
  silver: '#c0c0c0',
  bronze: '#cd7f32',
};

export default function MedalTimeline({
  selectedCountryCode,
  selectedCountryName,
  selectedDiscipline = null,
}: MedalTimelineProps) {
  const [data, setData] = useState<MedalRow[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<ComponentSize>({ width: 0, height: 0 });
  const [zoomTransform, setZoomTransform] = useState<d3.ZoomTransform>(d3.zoomIdentity);
  const margin: Margin = { top: 48, right: 20, bottom: 50, left: 56 };
  const onResize = useDebounceCallback((nextSize: ComponentSize) => setSize(nextSize), 200);

  useResizeObserver({ ref: chartRef as React.RefObject<HTMLDivElement>, onResize });

  useEffect(() => {
    const loadData = async () => {
      try {
        const rows = await d3.csv('../../data/medals.csv', (d) => ({
          medal_type: d.medal_type || '',
          medal_date: d.medal_date || '',
          country_code: d.country_code || '',
          discipline: d.discipline || '',
        }));
        setData(rows.filter((d) => d.medal_date && d.country_code));
      } catch (error) {
        console.error('Error loading medals.csv:', error);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (data.length === 0) return;
    if (size.width === 0 || size.height === 0) return;

    const svg = d3.select('#timeline-svg');
    svg.selectAll('*').remove();

    const parseDate = d3.timeParse('%Y-%m-%d');
    let filtered = data.filter((d) => d.country_code === selectedCountryCode);
    if (selectedDiscipline) {
      filtered = filtered.filter((d) => d.discipline === selectedDiscipline);
    }
    const grouped = d3.rollups(
      filtered,
      (v) => ({
        gold: v.filter((d) => d.medal_type === 'Gold Medal').length,
        silver: v.filter((d) => d.medal_type === 'Silver Medal').length,
        bronze: v.filter((d) => d.medal_type === 'Bronze Medal').length,
      }),
      (d) => d.medal_date,
    );

    const seriesData: MedalByDate[] = grouped
      .map(([date, counts]) => {
        const parsed = parseDate(date);
        if (!parsed) return null;
        const total = counts.gold + counts.silver + counts.bronze;
        return {
          date: parsed,
          gold: counts.gold,
          silver: counts.silver,
          bronze: counts.bronze,
          total,
        };
      })
      .filter((d): d is MedalByDate => d !== null)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    const innerWidth = size.width - margin.left - margin.right;
    const innerHeight = size.height - margin.top - margin.bottom;

    const titleText = selectedDiscipline
      ? `Focus: ${selectedCountryName} — ${selectedDiscipline}`
      : `Focus: Medal Timeline for ${selectedCountryName}`;
    svg
      .append('text')
      .attr('x', margin.left)
      .attr('y', 20)
      .style('font-weight', 600)
      .style('font-size', '0.95rem')
      .text(titleText);

    if (seriesData.length === 0) {
      svg
        .append('text')
        .attr('x', margin.left)
        .attr('y', 56)
        .style('font-size', '0.8rem')
        .style('fill', '#666')
        .text(selectedDiscipline ? 'No medals in this discipline.' : 'No medals recorded for this country.');
      return;
    }

    const xDomain = d3.extent(seriesData, (d) => d.date) as [Date, Date];
    const xScaleBase = d3
      .scaleTime()
      .domain(xDomain)
      .range([margin.left, size.width - margin.right]);

    const xScale = zoomTransform.rescaleX(xScaleBase);

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(seriesData, (d) => d.total) || 1])
      .nice()
      .range([size.height - margin.bottom, margin.top]);

    const stack = d3
      .stack<MedalByDate>()
      .keys(['gold', 'silver', 'bronze'])
      .order(d3.stackOrderNone)
      .offset(d3.stackOffsetNone);

    const stackedSeries = stack(seriesData);

    const area = d3
      .area<d3.SeriesPoint<MedalByDate>>()
      .x((d) => xScale(d.data.date))
      .y0((d) => yScale(d[0]))
      .y1((d) => yScale(d[1]))
      .curve(d3.curveMonotoneX);

    const xAxis = d3.axisBottom(xScale).ticks(5);
    const xAxisG = svg
      .append('g')
      .attr('transform', `translate(0, ${size.height - margin.bottom})`)
      .call(xAxis);
    xAxisG.selectAll('text').style('font-size', '0.7rem');
    xAxisG
      .transition()
      .duration(TRANSITION_DURATION)
      .ease(d3.easeCubicInOut);

    const yAxis = d3.axisLeft(yScale).ticks(4);
    const yAxisG = svg
      .append('g')
      .attr('transform', `translate(${margin.left}, 0)`)
      .call(yAxis);
    yAxisG.selectAll('text').style('font-size', '0.7rem');

    svg
      .append('text')
      .attr('x', (size.width + margin.left) / 2)
      .attr('y', size.height - 12)
      .style('text-anchor', 'middle')
      .style('font-size', '0.75rem')
      .text('Medal date (scroll to zoom, drag to pan)');

    svg
      .append('text')
      .attr('transform', `translate(${16}, ${(size.height + margin.top) / 2}) rotate(-90)`)
      .style('text-anchor', 'middle')
      .style('font-size', '0.75rem')
      .text('Medals awarded');

    const pathGroup = svg.append('g');
    pathGroup
      .selectAll('path')
      .data(stackedSeries)
      .join('path')
      .attr('d', area)
      .attr('fill', (d) => medalColors[d.key])
      .attr('opacity', 0)
      .transition()
      .duration(TRANSITION_DURATION)
      .ease(d3.easeCubicInOut)
      .attr('opacity', 0.85);

    const tooltip = chartRef.current?.ownerDocument?.getElementById('timeline-tooltip');
    const overlay = svg
      .append('rect')
      .attr('x', margin.left)
      .attr('y', margin.top)
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'grab');
    if (tooltip) {
      overlay
        .on('mousemove', function (event) {
          const x = margin.left + (event.offsetX ?? 0);
          const date = xScale.invert(x);
          const bisect = d3.bisector((d: MedalByDate) => d.date.getTime()).left;
          const i = Math.min(bisect(seriesData, date), seriesData.length - 1);
          const point = seriesData[i];
          if (!point) return;
          const fmt = d3.timeFormat('%b %d, %Y');
          tooltip.textContent = `${fmt(point.date)} — Gold: ${point.gold}, Silver: ${point.silver}, Bronze: ${point.bronze} (Total: ${point.total})`;
          tooltip.style.display = 'block';
          tooltip.style.left = `${event.pageX + 10}px`;
          tooltip.style.top = `${event.pageY + 10}px`;
        })
        .on('mouseleave', () => {
          if (tooltip) tooltip.style.display = 'none';
        });
    }
    overlay.on('mousedown', () => overlay.style('cursor', 'grabbing')).on('mouseup', () => overlay.style('cursor', 'grab'));

    const zoomBehavior = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([1, 32])
      .on('zoom', (event) => setZoomTransform(event.transform));
    svg.call(zoomBehavior);
    zoomBehavior.transform(svg as never, zoomTransform);

    const legendItems = [
      { key: 'gold', label: 'Gold' },
      { key: 'silver', label: 'Silver' },
      { key: 'bronze', label: 'Bronze' },
    ];

    const legend = svg.append('g').attr('transform', `translate(${margin.left}, ${margin.top - 20})`);

    legend
      .selectAll('rect')
      .data(legendItems)
      .join('rect')
      .attr('x', (_, i) => i * 70)
      .attr('y', 0)
      .attr('width', 12)
      .attr('height', 12)
      .attr('fill', (d) => medalColors[d.key]);

    legend
      .selectAll('text')
      .data(legendItems)
      .join('text')
      .attr('x', (_, i) => i * 70 + 18)
      .attr('y', 10)
      .style('font-size', '0.7rem')
      .text((d) => d.label);
  }, [data, size, selectedCountryCode, selectedCountryName, selectedDiscipline, zoomTransform]);

  useEffect(() => {
    setZoomTransform(d3.zoomIdentity);
  }, [selectedCountryCode, selectedDiscipline]);

  return (
    <div ref={chartRef} className="chart-container chart-container-timeline">
      <div id="timeline-tooltip" className="chart-tooltip" aria-hidden="true" />
      <svg id="timeline-svg" width="100%" height="100%"></svg>
    </div>
  );
}

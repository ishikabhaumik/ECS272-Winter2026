import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useResizeObserver, useDebounceCallback } from 'usehooks-ts';
import { ComponentSize, Margin } from '../types';

interface MedalRow {
  medal_type: string;
  discipline: string;
  country_code: string;
}

interface DisciplineHeatmapProps {
  selectedCountryCode: string;
  selectedCountryName: string;
}

interface HeatmapCell {
  discipline: string;
  medalType: string;
  count: number;
}

const medalTypes = ['Gold Medal', 'Silver Medal', 'Bronze Medal'];

export default function DisciplineHeatmap({
  selectedCountryCode,
  selectedCountryName,
}: DisciplineHeatmapProps) {
  const [data, setData] = useState<MedalRow[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<ComponentSize>({ width: 0, height: 0 });
  const margin: Margin = { top: 52, right: 24, bottom: 40, left: 130 };
  const onResize = useDebounceCallback((nextSize: ComponentSize) => setSize(nextSize), 200);

  useResizeObserver({ ref: chartRef as React.RefObject<HTMLDivElement>, onResize });

  useEffect(() => {
    const loadData = async () => {
      try {
        const rows = await d3.csv('../../data/medals.csv', (d) => ({
          medal_type: d.medal_type || '',
          discipline: d.discipline || '',
          country_code: d.country_code || '',
        }));
        setData(rows.filter((d) => d.discipline && d.country_code));
      } catch (error) {
        console.error('Error loading medals.csv:', error);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (data.length === 0) return;
    if (size.width === 0 || size.height === 0) return;

    const svg = d3.select('#heatmap-svg');
    svg.selectAll('*').remove();

    const filtered = data.filter((d) => d.country_code === selectedCountryCode);

    const byDiscipline = d3.rollups(
      filtered,
      (v) => v.length,
      (d) => d.discipline,
    );

    const topDisciplines = byDiscipline
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([discipline]) => discipline);

    const cells: HeatmapCell[] = [];
    topDisciplines.forEach((discipline) => {
      medalTypes.forEach((medalType) => {
        const count =
          filtered.filter((d) => d.discipline === discipline && d.medal_type === medalType)
            .length || 0;
        cells.push({ discipline, medalType, count });
      });
    });

    const innerWidth = size.width - margin.left - margin.right;
    const innerHeight = size.height - margin.top - margin.bottom;

    svg
      .append('text')
      .attr('x', margin.left)
      .attr('y', 20)
      .style('font-weight', 600)
      .style('font-size', '0.95rem')
      .text(`Detail: Discipline Mix for ${selectedCountryName} (Top 12)`);

    if (cells.length === 0) {
      svg
        .append('text')
        .attr('x', margin.left)
        .attr('y', 48)
        .style('font-size', '0.8rem')
        .style('fill', '#666')
        .text('No discipline-level medals recorded for this country.');
      return;
    }

    const xScale = d3
      .scaleBand()
      .domain(medalTypes)
      .range([margin.left, margin.left + innerWidth])
      .padding(0.12);

    const yScale = d3
      .scaleBand()
      .domain(topDisciplines)
      .range([margin.top, margin.top + innerHeight])
      .padding(0.15);

    const maxCount = d3.max(cells, (d) => d.count) || 1;
    const color = d3.scaleSequential(d3.interpolateBlues).domain([0, maxCount]);

    svg
      .append('g')
      .selectAll('rect')
      .data(cells)
      .join('rect')
      .attr('x', (d) => xScale(d.medalType) || 0)
      .attr('y', (d) => yScale(d.discipline) || 0)
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('fill', (d) => color(d.count));

    svg
      .append('g')
      .attr('transform', `translate(0, ${margin.top + innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickFormat((d) => (d as string).replace(' Medal', '')),
      )
      .selectAll('text')
      .style('font-size', '0.7rem');

    svg
      .append('g')
      .attr('transform', `translate(${margin.left}, 0)`)
      .call(
        d3.axisLeft(yScale).tickFormat((d) => {
          const text = d as string;
          return text.length > 18 ? `${text.slice(0, 16)}…` : text;
        }),
      )
      .selectAll('text')
      .style('font-size', '0.7rem');

    svg
      .append('text')
      .attr('x', margin.left + innerWidth / 2)
      .attr('y', size.height - 8)
      .style('text-anchor', 'middle')
      .style('font-size', '0.75rem')
      .text('Medal type');

    svg
      .append('text')
      .attr('transform', `translate(${20}, ${margin.top + innerHeight / 2}) rotate(-90)`)
      .style('text-anchor', 'middle')
      .style('font-size', '0.75rem')
      .text('Discipline');

    const legendWidth = 120;
    const legendHeight = 10;
    const legendX = size.width - legendWidth - 20;
    const legendY = margin.top - 28;

    const defs = svg.append('defs');
    const gradient = defs
      .append('linearGradient')
      .attr('id', 'heatmap-legend-gradient')
      .attr('x1', '0%')
      .attr('x2', '100%')
      .attr('y1', '0%')
      .attr('y2', '0%');

    gradient.append('stop').attr('offset', '0%').attr('stop-color', color(0));
    gradient.append('stop').attr('offset', '100%').attr('stop-color', color(maxCount));

    svg
      .append('rect')
      .attr('x', legendX)
      .attr('y', legendY)
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .attr('fill', 'url(#heatmap-legend-gradient)')
      .attr('stroke', '#ccc');

    const legendScale = d3.scaleLinear().domain([0, maxCount]).range([0, legendWidth]);
    const legendAxis = d3.axisBottom(legendScale).ticks(3).tickSize(3);

    svg
      .append('g')
      .attr('transform', `translate(${legendX},${legendY + legendHeight})`)
      .call(legendAxis)
      .selectAll('text')
      .style('font-size', '0.6rem');
  }, [data, size, selectedCountryCode, selectedCountryName]);

  return (
    <div ref={chartRef} className="chart-container">
      <svg id="heatmap-svg" width="100%" height="100%"></svg>
    </div>
  );
}

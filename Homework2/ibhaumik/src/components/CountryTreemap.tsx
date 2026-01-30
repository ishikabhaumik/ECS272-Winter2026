import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useResizeObserver, useDebounceCallback } from 'usehooks-ts';
import { ComponentSize, Margin } from '../types';

interface MedalTotalRow {
  country_code: string;
  country: string;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
}

interface CountryTreemapProps {
  selectedCountryCode: string;
  onSelectCountry: (code: string, name: string) => void;
}

export default function CountryTreemap({
  selectedCountryCode,
  onSelectCountry,
}: CountryTreemapProps) {
  const [data, setData] = useState<MedalTotalRow[]>([]);
  const chartRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<ComponentSize>({ width: 0, height: 0 });
  const margin: Margin = { top: 48, right: 20, bottom: 48, left: 12 };
  const onResize = useDebounceCallback((nextSize: ComponentSize) => setSize(nextSize), 200);

  useResizeObserver({ ref: chartRef as React.RefObject<HTMLDivElement>, onResize });

  useEffect(() => {
    const loadData = async () => {
      try {
        const rows = await d3.csv('../../data/medals_total.csv', (d) => ({
          country_code: d.country_code || '',
          country: d.country || '',
          gold: +(d['Gold Medal'] || 0),
          silver: +(d['Silver Medal'] || 0),
          bronze: +(d['Bronze Medal'] || 0),
          total: +(d['Total'] || 0),
        }));
        setData(rows.filter((d) => d.country_code));
      } catch (error) {
        console.error('Error loading medals_total.csv:', error);
      }
    };
    loadData();
  }, []);

  useEffect(() => {
    if (data.length === 0) return;
    if (size.width === 0 || size.height === 0) return;

    const svg = d3.select('#treemap-svg');
    svg.selectAll('*').remove();

    const innerWidth = size.width - margin.left - margin.right;
    const innerHeight = size.height - margin.top - margin.bottom;

    const minTotal = d3.min(data, (d) => d.total) ?? 0;
    const maxTotal = d3.max(data, (d) => d.total) ?? 1;
    const color = d3.scaleSequential(d3.interpolateYlOrBr).domain([minTotal, maxTotal]);

    const root = d3
      .hierarchy({ children: data } as d3.HierarchyNode<MedalTotalRow>)
      .sum((d: any) => d.total)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    d3.treemap<MedalTotalRow>()
      .size([innerWidth, innerHeight])
      .paddingInner(2)
      .round(true)(root as any);

    const chart = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const leaves = chart
      .selectAll('g')
      .data(root.leaves())
      .join('g')
      .attr('transform', (d) => `translate(${d.x0},${d.y0})`);

    leaves
      .append('rect')
      .attr('width', (d) => d.x1 - d.x0)
      .attr('height', (d) => d.y1 - d.y0)
      .attr('fill', (d) => color(d.data.total))
      .attr('stroke', (d) => (d.data.country_code === selectedCountryCode ? '#111' : '#fff'))
      .attr('stroke-width', (d) => (d.data.country_code === selectedCountryCode ? 2 : 1))
      .style('cursor', 'pointer')
      .on('click', (_, d) => onSelectCountry(d.data.country_code, d.data.country));

    const topLabels = new Set(
      [...data]
        .sort((a, b) => b.total - a.total)
        .slice(0, 12)
        .map((d) => d.country_code),
    );

    leaves
      .filter((d) => topLabels.has(d.data.country_code))
      .append('text')
      .attr('x', 6)
      .attr('y', 16)
      .style('font-size', '0.7rem')
      .style('fill', '#1b1b1b')
      .text((d) => `${d.data.country_code} (${d.data.total})`);

    svg
      .append('text')
      .attr('x', margin.left)
      .attr('y', 20)
      .style('font-weight', 600)
      .style('font-size', '0.95rem')
      .text('Overview: Total Medals by Country (Treemap)');

    svg
      .append('text')
      .attr('x', margin.left)
      .attr('y', 36)
      .style('font-size', '0.72rem')
      .style('fill', '#444')
      .text('Click a country to update the focus views.');

    svg
      .append('text')
      .attr('x', size.width / 2)
      .attr('y', size.height - 8)
      .style('text-anchor', 'middle')
      .style('font-size', '0.75rem')
      .style('fill', '#444')
      .text('Countries (area encodes total medals)');

    svg
      .append('text')
      .attr('transform', `translate(${14}, ${size.height / 2}) rotate(-90)`)
      .style('text-anchor', 'middle')
      .style('font-size', '0.75rem')
      .style('fill', '#444')
      .text('Total medals (color)');

    const legendWidth = 120;
    const legendHeight = 10;
    const legendX = size.width - legendWidth - 20;
    const legendY = size.height - 24;

    const defs = svg.append('defs');
    const gradient = defs
      .append('linearGradient')
      .attr('id', 'treemap-legend-gradient')
      .attr('x1', '0%')
      .attr('x2', '100%')
      .attr('y1', '0%')
      .attr('y2', '0%');

    gradient.append('stop').attr('offset', '0%').attr('stop-color', color(minTotal));
    gradient.append('stop').attr('offset', '100%').attr('stop-color', color(maxTotal));

    svg
      .append('rect')
      .attr('x', legendX)
      .attr('y', legendY)
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .attr('fill', 'url(#treemap-legend-gradient)')
      .attr('stroke', '#ccc');

    const legendScale = d3.scaleLinear().domain([minTotal, maxTotal]).range([0, legendWidth]);
    const legendAxis = d3
      .axisBottom(legendScale)
      .ticks(3)
      .tickSize(3);

    svg
      .append('g')
      .attr('transform', `translate(${legendX},${legendY + legendHeight})`)
      .call(legendAxis)
      .selectAll('text')
      .style('font-size', '0.6rem');
  }, [data, size, selectedCountryCode, onSelectCountry]);

  return (
    <div ref={chartRef} className="chart-container">
      <svg id="treemap-svg" width="100%" height="100%"></svg>
    </div>
  );
}

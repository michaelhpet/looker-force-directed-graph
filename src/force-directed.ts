import * as d3 from "d3";
import { handleErrors } from "./utils";
import {
  nodeTooltip,
  linkTooltip,
  updatePosition,
  hideTooltip,
  initTooltip,
  highlightNeighbors,
  clearHighlight,
} from "./tooltip";
import { Row, Looker, VisualizationDefinition } from "./types";

// Global values provided via the API
declare var looker: Looker;
declare var LookerCharts: any;

interface ForceDirectedGraphVisualization extends VisualizationDefinition {
  svg?: any;
}

const vis: ForceDirectedGraphVisualization = {
  id: "force-directed", // id/label not required, but nice for testing and keeping manifests in sync
  label: "Force Directed Graph",
  options: {
    nodeDivider: {
      section: "Graph",
      type: "string",
      label: "Nodes -----------------------------------------",
      display: "divider",
      order: 8,
    },
    color_range: {
      type: "array",
      section: "Graph",
      label: "Node Color Range",
      display: "colors",
      display_size: "half",
      default: [
        "#1f77b4",
        "#ff7f0e",
        "#2ca02c",
        "#d62728",
        "#9467bd",
        "#8c564b",
        "#e377c2",
        "#7f7f7f",
        "#bcbd22",
        "#17becf",
      ],
      order: 9,
    },
    circle_radius: {
      section: "Graph",
      type: "number",
      display: "range",
      display_size: "half",
      label: "Circle Radius",
      min: 1,
      max: 40,
      step: 1,
      default: 5,
      order: 10,
    },

    linkDivider: {
      section: "Graph",
      type: "string",
      label: "Links -----------------------------------------",
      display: "divider",
      order: 19,
    },
    link_color: {
      section: "Graph",
      type: "string",
      display: "color",
      display_size: "half",
      label: "Link Color",
      default: "#000000",
      order: 20,
    },
    linkDistance: {
      section: "Graph",
      type: "number",
      display: "range",
      display_size: "half",
      label: "Link Distance",
      default: 30,
      min: 5,
      max: 300,
      step: 5,
      order: 21,
    },
    edge_weight: {
      type: "string",
      section: "Graph",
      display: "select",
      display_size: "half",
      label: "Link Weight Function",
      values: [
        { "Square Root": "sqrt" },
        { "Cube Root": "cbrt" },
        { log2: "log2" },
        { log10: "log10" },
      ],
      default: "sqrt",
      order: 22,
    },

    labelDivider: {
      section: "Labels",
      type: "string",
      display: "divider",
      label: "Labels -----------------------------------------",
      order: 90,
    },
    font_family: {
      section: "Labels",
      order: 91,
      type: "string",
      display: "select",
      display_size: "half",
      label: "Font family",
      values: [
        { Looker: '"Google Sans"' },
        {
          Helvetica:
            'BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif',
        },
        {
          "Times New Roman":
            'Roboto, "Noto Sans", "Noto Sans JP", "Noto Sans CJK KR", "Noto Sans Arabic UI", "Noto Sans Devanagari UI", "Noto Sans Hebrew", "Noto Sans Thai UI", Helvetica, Arial, sans-serif',
        },
      ],
      default: '"Google Sans"',
    },
    font_color: {
      section: "Labels",
      type: "string",
      display: "color",
      display_size: "half",
      label: "Label Color",
      default: "#000000",
      order: 92,
    },
    labels: {
      section: "Labels",
      type: "string",
      label: "Labels",
      display: "select",
      values: [
        { None: "none" },
        { "Source Group": "source_group" },
        { "Target Group": "target_group" },
        { All: "all" },
        { "On Hover": "on_hover" },
      ],
      display_size: "half",
      order: 93,
      default: "all",
    },
    labelTypes: {
      section: "Labels",
      type: "string",
      label: "Filter Node Labels",
      placeholder: 'List of values from "Source"/"Target" groups',
      default: "",
      order: 94,
    },
    font_weight: {
      section: "Labels",
      type: "string",
      label: "Label Font Weight",
      display: "select",
      display_size: "half",
      values: [{ Normal: "normal" }, { Bold: "bold" }],
      default: "normal",
      order: 95,
    },
    font_size: {
      section: "Labels",
      type: "string",
      label: "Label Font Size",
      display_size: "half",
      default: ["10"],
      order: 96,
    },

    tooltipDivider: {
      section: "Labels",
      label: "Tooltip -----------------------------------------",
      type: "string",
      display: "divider",
      order: 100,
    },
    highlight_selection: {
      order: 101,
      section: "Labels",
      type: "boolean",
      label: "Focus on Hover",
      default: true,
    },
    tooltip: {
      section: "Labels",
      type: "boolean",
      label: "Tooltip",
      default: true,
      order: 102,
    },
    tooltipFont: {
      section: "Labels",
      type: "string",
      label: "Tooltip Font Size",
      default: "11",
      order: 103,
    },
    tooltipValFormat: {
      section: "Labels",
      type: "string",
      label: "Value Format (measure)",
      placeholder: "Spreadsheet-style value format",
      order: 104,
    },
  },

  // Set up the initial state of the visualization
  create(element) {
    element.innerHTML = `
    <head>
    <link href='https://fonts.googleapis.com/css2?family=Google+Sans:wght@100;200;300;400;500;700;900&display=swap' rel='stylesheet'>
    </head>
  `;
    element.style.fontFamily = `"Open Sans", "Helvetica", sans-serif`;
    this.svg = d3.select(element).append("svg");
  },
  // Render in response to the data or settings changing
  updateAsync(data, element, config, queryResponse, details, done) {
    this.clearErrors();
    if (
      !handleErrors(this, queryResponse, {
        min_pivots: 0,
        max_pivots: 0,
        min_dimensions: 2,
        max_dimensions: 4,
        min_measures: 0,
        max_measures: 1,
      })
    )
      return;

    // Catch the rare edge case on DB-next that the config is unset
    const applyDefualtConfig = () => {
      for (let option in this.options) {
        if (config[option] === undefined) {
          config[option] = this.options[option].default;
        }
      }
    };

    if (config.color_range === undefined) {
      applyDefualtConfig();
    }

    this.svg.selectAll("*").remove();

    if (config.tooltip) {
      initTooltip(config.tooltipFont);
    }

    const SOURCE_NODE = "SOURCE_NODE";
    const TARGET_NODE = "TARGET_NODE";
    const SOURCE_GROUP = "SOURCE_GROUP";
    const TARGET_GROUP = "TARGET_GROUP";
    const SOURCE = "SOURCE";
    const TARGET = "TARGET";
    let graphOptions = [SOURCE_NODE, TARGET_NODE, SOURCE_GROUP, TARGET_GROUP];
    let labels = ["Source node", "Target node", "Source group", "Target group"];

    const generateOptions = (dimensions) => {
      let newOptions = Object.assign({}, this.options);
      let selections = dimensions.map((d) => ({
        [d.label_short || d.label]: d.name,
      }));
      graphOptions.forEach((g, i) => {
        newOptions[g] = {
          section: "Graph",
          label: labels[i],
          type: "string",
          display: "select",
          display_size: "half",
          values: selections,
          order: 10 + i,
          default: dimensions[i % dimensions.length].name,
        };
      });
      this.trigger("registerOptions", newOptions);
    };

    const height = element.clientHeight + 20;
    const width = element.clientWidth;
    const radius = config.circle_radius;
    const linkDistance = config.linkDistance;
    const dimensions = queryResponse.fields.dimension_like;
    const measure = queryResponse.fields.measure_like[0] || null;
    const valFormat =
      measure?.value_format || config?.tooltipValFormat || "#,###";

    generateOptions(dimensions);
    if (config[SOURCE_NODE] === undefined || config[SOURCE_NODE] === "") {
      generateOptions(dimensions);
    }

    let isDragging = false;
    const drag = (simulation) => {
      function dragstarted(d) {
        isDragging = true;
        if (!d3.event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      }

      function dragged(d) {
        d.fx = d3.event.x;
        d.fy = d3.event.y;
      }

      function dragended(d) {
        if (!d3.event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
        isDragging = false;
      }

      return d3
        .drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended);
    };

    const colorScale = d3.scaleOrdinal();
    var color = colorScale.range(d3.schemeCategory10);
    if (config.color_range != null) {
      color = colorScale.range(config.color_range);
    }

    var nodes_unique = [];
    var groups_unique = [];
    var nodes = [];
    var links = [];

    // First make the nodes array
    data.forEach((row: Row) => {
      if (
        row[config[SOURCE_NODE]] === undefined ||
        row[config[TARGET_NODE]] === undefined ||
        row[config[SOURCE_NODE]]?.value === null ||
        row[config[TARGET_NODE]]?.value === null
      ) {
        return;
      }
      if (nodes_unique.indexOf(row[config[SOURCE_NODE]].value) == -1) {
        nodes_unique.push(row[config[SOURCE_NODE]].value);
        if (groups_unique.indexOf(row[config[SOURCE_GROUP]].value) == -1) {
          groups_unique.push(row[config[SOURCE_GROUP]].value);
        }
        let nodeDim = dimensions.find((e) => e.name === config[SOURCE_NODE]);
        let groupDim = dimensions.find((e) => e.name === config[SOURCE_GROUP]);
        const newnode = {
          id: row[config[SOURCE_NODE]].value,
          group: row[config[SOURCE_GROUP]].value,
          groupType: SOURCE,
          nodeField: nodeDim.label_short || nodeDim.short,
          groupField: groupDim.label_short || groupDim.short,
        };
        nodes.push(newnode);
      }
      if (nodes_unique.indexOf(row[config[TARGET_NODE]].value) == -1) {
        nodes_unique.push(row[config[TARGET_NODE]].value);
        if (groups_unique.indexOf(row[config[TARGET_GROUP]].value) == -1) {
          groups_unique.push(row[config[TARGET_GROUP]].value);
        }
        let nodeDim = dimensions.find((e) => e.name === config[TARGET_NODE]);
        let groupDim = dimensions.find((e) => e.name === config[TARGET_GROUP]);
        const newnode = {
          id: row[config[TARGET_NODE]].value,
          group: row[config[TARGET_GROUP]].value,
          groupType: TARGET,
          nodeField: nodeDim.label_short || nodeDim.label,
          groupField: groupDim.label_short || nodeDim.label,
        };
        nodes.push(newnode);
      }
      const newlink = {
        source: row[config[SOURCE_NODE]].value,
        target: row[config[TARGET_NODE]].value,
        value: measure ? row[measure.name].value : 1,
      };
      links.push(newlink);
    });

    if (nodes.length < 1) {
      this.addError({
        title: "No nodes to plot.",
        message: "Check for null values in either the start or end nodes.",
      });
      done();
    }

    var manybody = d3.forceManyBody();
    //manybody.strength(-7)

    var func = {
      sqrt: (d) => Math.sqrt(d),
      cbrt: (d) => Math.cbrt(d),
      log2: (d) => Math.log2(d),
      log10: (d) => Math.log10(d),
    };

    let highestNodeWeight = 1;
    const getNodeWeight = (label) => {
      const edges = links.filter(
        (link) => link.source.id === label || link.target.id === label
      );
      const weight = edges.length ?? 1;
      if (weight > highestNodeWeight) highestNodeWeight = weight;
      return weight;
    };

    const simulation = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(links)
          .distance((d) => {
            const weight = func[config.edge_weight](d.value);
            return linkDistance * weight - highestNodeWeight;
          })
          .id((d) => (d as any).id)
      )
      .force("charge", manybody)
      .force("center", d3.forceCenter(width / 2, height / 2));

    const toggleCrossfilter = (event, index) => {
      const pageX = event.pageX ?? event.native.pageX;
      const pageY = event.pageY ?? event.native.pageY;
      LookerCharts.Utils.toggleCrossfilter({
        row: data[index],
        event: { pageX, pageY },
      });
    };

    const openDrillMenu = (event, links) => {
      const pageX = event.pageX ?? event.native.pageX;
      const pageY = event.pageY ?? event.native.pageY;
      LookerCharts.Utils.openDrillMenu({
        event: { pageX, pageY },
        links,
      });
    };

    const closeDrillMenu = () => {
      LookerCharts.Utils.openDrillMenu({
        event: {
          pageX: Number.MAX_SAFE_INTEGER,
          pageY: Number.MAX_SAFE_INTEGER,
        },
        links: [
          {
            label: "Open in new tab",
            type: "url",
            url: window.location.href,
          },
        ],
      });
    };

    const svg = this.svg!.attr("width", "100%").attr("height", height);

    const link = svg
      .append("g")
      .attr("stroke", config.link_color)
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .attr("value", (d) => d.value)
      .attr("target", (d) => d.target.id)
      .attr("source", (d) => d.source.id)
      .attr("stroke-width", (d) => {
        if (measure) {
          return func[config.edge_weight](d.value);
        }
        return d.value;
      })
      .on("mouseover", function (d) {
        d3.select(this).attr("stroke", "#FFA500");
        if (config.tooltip) {
          linkTooltip(d, d3.event, isDragging, measure, valFormat);
        }
      })
      .on("mousemove", (d) => {
        if (config.tooltip) {
          updatePosition(d, d3.event, isDragging, "link");
        }
      })
      .on("mouseleave", function () {
        d3.select(this).attr("stroke", config.link_color);
        hideTooltip();
      })
      .on("click", function () {
        const target = d3.event.target;
        if (target.tagName !== "circle") closeDrillMenu();
      });

    element.onclick = function (event: any) {
      if (event.target.nodeName !== "circle") closeDrillMenu();
    };

    var node = svg
      .append("g")
      .attr("class", "nodes")
      .selectAll(".node")
      .data(nodes)
      .enter()
      .append("g")
      .attr("class", "node")
      .call(drag(simulation));

    node
      .append("circle")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .attr("id", (d) => d.id)
      .attr("r", (d) => {
        const weight = getNodeWeight(d.id);
        return radius * weight;
      })
      .attr("fill", (d) => color(d.group))
      .on("mouseover", function (d) {
        d3.select(this).attr("stroke-width", 1.5).attr("stroke", "#FFA500");
        if (config.tooltip) {
          nodeTooltip(d, d3.event, isDragging);
        }
        if (config.highlight_selection || config.labels === "on_hover") {
          highlightNeighbors(
            d,
            d3.event,
            isDragging,
            config.labels === "on_hover",
            config.highlight_selection
          );
        }
      })
      .on("mousemove", (d) => {
        if (config.tooltip) {
          updatePosition(d, d3.event, isDragging, "node");
        }
      })
      .on("mouseleave mousedown", function () {
        d3.select(this).attr("stroke-width", 1).attr("stroke", "#fff");
        hideTooltip();
        if (config.highlight_selection || config.labels === "on_hover") {
          clearHighlight(config.labels === "on_hover");
        }
      })
      .on("click", function (d) {
        let nodeLinks: any[] = [
          {
            label: `View Details for ${d.id}`,
            url: `/explore/model_name/view_name?fields=field_name&filter[field_name]=${d.id}`,
            type: "drill",
          },
          {
            label: "External Link",
            url: "https://example.com",
            type: "drill",
          },
        ];
        for (const node of data) {
          if (
            node[config[SOURCE_NODE]].value === d.id ||
            node[config[TARGET_NODE]].value === d.id
          )
            nodeLinks = nodeLinks.concat(
              node[config[SOURCE_NODE]].links ?? [],
              node[config[TARGET_NODE]].links ?? []
            );
        }
        if (details.crossfilterEnabled) toggleCrossfilter(d3.event, d.index);
        else openDrillMenu(d3.event, nodeLinks);
      })
      .on("contextmenu", function (d) {
        if (!details.crossfilterEnabled) return;
        d3.event.preventDefault();
        let nodeLinks: any[] = [
          {
            label: `View Details for ${d.id}`,
            url: `/explore/model_name/view_name?fields=field_name&filter[field_name]=${d.id}`,
            type: "drill",
          },
          {
            label: "External Link",
            url: "https://example.com",
            type: "drill",
          },
        ];
        for (const node of data) {
          if (
            node[config[SOURCE_NODE]].value === d.id ||
            node[config[TARGET_NODE]].value === d.id
          )
            nodeLinks = nodeLinks.concat(
              node[config[SOURCE_NODE]].links ?? [],
              node[config[TARGET_NODE]].links ?? []
            );
        }
        openDrillMenu(d3.event, nodeLinks);
      });

    var labelTypes = [];
    if (config.labelTypes && config.labelTypes.length) {
      labelTypes = config.labelTypes.split(",").map((e) => e.trim());
    }

    if (config.labels && config.labelTypes && config.labelTypes.length) {
      node
        .append("text")
        .attr("id", (d) => d.id)
        .style("font-size", config.font_size)
        .style("fill", config.font_color)
        .attr("y", -1 * config.circle_radius - 3 + "px")
        .style("text-anchor", "middle")
        .style("font-weight", config.font_weight)
        .style("font-family", config.font_family)
        .text(function (d) {
          if (labelTypes.indexOf(d.group) > -1) {
            return d.id;
          } else {
            return null;
          }
        });
    } else if (config.labels !== "none") {
      node
        .append("text")
        .attr("id", (d) => d.id)
        .style("font-size", config.font_size)
        .style("fill", config.font_color)
        .attr("y", -1 * config.circle_radius - 3 + "px")
        .style("text-anchor", "middle")
        .style("font-weight", config.font_weight)
        .style("font-family", config.font_family)
        .text(function (d) {
          if (config.labels === "all" || config.labels === "on_hover") {
            return d.id;
          } else if (config.labels === "source_group") {
            if (d.groupType === SOURCE) {
              return d.id;
            } else {
              return "";
            }
          } else if (config.labels === "target_group") {
            if (d.groupType === TARGET) {
              return d.id;
            } else {
              return "";
            }
          }
        });
    }

    if (config.labels === "on_hover") {
      d3.selectAll("text").attr("opacity", 0);
    }

    const margin = radius * highestNodeWeight;
    simulation.on("tick", () => {
      link
        .attr("x1", (d) => {
          const sourceX = isNaN(d.source.x)
            ? width / 2
            : Math.max(margin, Math.min(width - margin, d.source.x));
          return sourceX;
        })
        .attr("y1", (d) => {
          const sourceY = isNaN(d.source.y)
            ? height / 2
            : Math.max(margin, Math.min(height - margin, d.source.y));
          return sourceY;
        })
        .attr("x2", (d) => {
          const targetX = isNaN(d.target.x)
            ? width / 2
            : Math.max(margin, Math.min(width - margin, d.target.x));
          return targetX;
        })
        .attr("y2", (d) => {
          const targetY = isNaN(d.target.y)
            ? height / 2
            : Math.max(margin, Math.min(height - margin, d.target.y));
          return targetY;
        });

      node.attr("transform", function (d) {
        d.x = Math.max(margin, Math.min(width - margin, d.x));
        d.y = Math.max(margin, Math.min(height - margin, d.y));
        return `translate(${d.x},${d.y})`;
      });
    });
    done();
  },
};

looker.plugins.visualizations.add(vis);

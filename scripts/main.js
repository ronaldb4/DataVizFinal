// significant borrowing and adaptation from https://www.visualcinnamon.com/2015/07/voronoi.html
// simple-statistics.js library used for regression line calculation

var scatterHeight = 600;
var scatterWidth = 600;
var filterSet = {};
var showGuideHint = true;

'use strict';
function init() {
	clearFilterSet();
	
	/*
	 * set heights of scatterplot and text area
	 */
    scatterHeight = Math.min(scatterHeight,document.getElementById("scatterplot").clientHeight) ;
    scatterWidth = document.getElementById("scatterplot").clientWidth;

    document.querySelector(".vizText").setAttribute("style","height:"+(scatterHeight)+"px");
    
	var exploreSec = document.querySelector("#section9");
	var exploreSecTopBotMargin = (scatterHeight-exploreSec.clientHeight)/2;
	exploreSec.setAttribute("style","margin-top:"+(exploreSecTopBotMargin)+"px;margin-bottom:"+(exploreSecTopBotMargin)+"px;")
    
    /*
     * attach listeners to controls in "Explore"
     */
    document.querySelectorAll(".region-filter")
    	.forEach(item => {item.addEventListener('change', (event) => { updateFilterSet("region",item.value); }) });
    document.querySelectorAll(".tb-group-filter")
    	.forEach(item => {item.addEventListener('change', (event) => { updateFilterSet("tb",item.value); }) });
    document.querySelectorAll(".gdp-group-filter")
    	.forEach(item => {item.addEventListener('change', (event) => { updateFilterSet("gdp",item.value); }) });
	document.querySelector("#sel-country")
		.addEventListener('change', () => {
			updateFilterSet("countryCode"); 
		});
		
	var baseYear = years[years.length-1];
	loadYear(baseYear);
	
	var initialPosition = function(){
		clearFilterSet();
		removeRegressionLine();
		removeRegionTrend();
		removeColor();
		removePopovers();
		hideGuide(null,true);
		removeAnnotations();
		
		showScatter();
		setScatterTitle("Tuberculosis Incidence and GDP")
		setScatterSubTitle("");
		
		showOrientingLabels();
	}
	var showSection2 = function(){
		removeOrientingLabels();
		
		d3.select("#scrollPrompt").remove();
		clearFilterSet();
		removeRegionTrend();
		removePopovers();
		hideGuide(null,true);
		
		showConforming();
		showRegressionLine();
		setScatterTitle("A Common Thread")
		setScatterSubTitle("");
		
		addAnnotations([
				{ data: yearDataByCountryCode['LUX'], position: [0,-100] },
				{ data: yearDataByCountryCode['USA'], position: [-20,50] },
				{ data: yearDataByCountryCode['SOM'], position: [-20,100] },
				{ data: yearDataByCountryCode['CAF'], position: [20,-20] }
			])
	}
	var showSection3 = function(){
		removeOrientingLabels();
		clearFilterSet();
		removeRegionTrend();
		removePopovers();
		hideGuide(null,true);
				
		showOutliers();
		setScatterTitle("Outliers");
		setScatterSubTitle("");
		addAnnotations([
			{ data: yearDataByCountryCode['BFA'], position: [-60,50] },
			{ data: yearDataByCountryCode['GAB'], position: [150,20] },
			{ data: yearDataByCountryCode['DMA'], position: [-100,-20] },
			{ data: yearDataByCountryCode['SGP'], position: [60,-30] }
		])
	}
	var showSection4 = function(){
		removeOrientingLabels();
		clearFilterSet();
		removeRegionTrend();
		removePopovers();
		hideGuide(null,true);
		
		setScatterTitle("Middle Income Countries")
		setScatterSubTitle("TB Incidence Variations");
		colorGdpBins([4,5,6,7]);
		addAnnotations([
			{ data: yearDataByCountryCode['GAB'], position: [150,20] },
			{ data: yearDataByCountryCode['DMA'], position: [-100,-20] },
		])
	}
	var showSection6 = function(){
		removeOrientingLabels();
		clearFilterSet();
		removeRegionTrend();
		removePopovers();
		hideGuide(null,true);
		
		setScatterTitle("Middle TB Incidence Countries")
		setScatterSubTitle("Income Variations");
		colorTbBins([5,6,7]);
		addAnnotations([
			{ data: yearDataByCountryCode['BFA'], position: [-60,50] },
			{ data: yearDataByCountryCode['SGP'], position: [60,-30] }
		])
	}
	var showSection7 = function(){
		removeOrientingLabels();
		clearFilterSet();
		removePopovers();
		hideGuide(null,true);
		
		setScatterTitle("East Asia & Pacific")
		addLineAnnotations(
				"East Asia & Pacific",
				"The relationship between Income and TB is slightly weaker than global, but the overall incidence is higher", 
				{x: 20, y: -80 });
		setScatterSubTitle("Regional Differences");
		updateFilterSet("region","eap");
	}
	var showSection8 = function(){
		removeOrientingLabels();
		clearFilterSet();
		removePopovers();
		hideGuide(null,true);
		
		setScatterTitle("Sub-Saharan Africa");
		setScatterSubTitle("Regional Differences");
		updateFilterSet("region","ssa");
		addLineAnnotations(
				"Sub-Saharan Africa",
				"The relationship between Income and TB is far weaker than global", 
				{x: 20, y: -20 });
	}
	var showSection9 = function(){
		removeOrientingLabels();
		clearFilterSet();
		removeAnnotations();
		
		setScatterTitle("Explore")
		setScatterSubTitle("");
		colorByRegion();
		addPopovers();
		loadCountries();
		if (showGuideHint){
			showGuide({data:yearDataByCountryCode['EGY']})
		    var element = d3.selectAll("#EGY");
		    var x = +element.attr("cx") - 190,
		        y = +element.attr("cy") + 40;
		    
		    //populate tooltip and show
		    d3.select("#scatterBody")
		    	.append("text")
		    	.attr("id","hoverHint")
		        .attr("x", x+5)
		        .attr("y", y-3)
		        .attr("class","tooltip")
		        .style("pointer-events", "none")
		        .style("opacity",0)
		        .style("font-style","italic")
		        .text("hover over country for guides")
		        .transition().delay(600)
		        .style("opacity",0.8);
		    
		}
	}

	
	/*
	 * set-up observer for modifying the scatter based on scroll
	 */
	const sections = document.querySelectorAll(".sectionText");
	var threshold = 1;
	var maxSectionHeight = -1;
	sections.forEach(section => {
		console.log(section)
		if (section.clientHeight>maxSectionHeight)
			maxSectionHeight = section.clientHeight;
	})
	maxSectionHeight+=60;
	if (maxSectionHeight>scatterHeight)
		threshold = scatterHeight/maxSectionHeight;
	
	console.log(maxSectionHeight + " vs. " + scatterHeight)
	const sectionObserver = new IntersectionObserver(
			function(entries, observer){
				entries.forEach(entry => {
					if (entry.isIntersecting){
						switch(entry.target.id){
							case 'section1' : initialPosition(); break; 
							case 'section2' : showSection2(); break; 
							case 'section3' : showSection3(); break; 
							case 'section4' : showSection4(); break; 
							case 'section6' : showSection6(); break; 
							case 'section7' : showSection7(); break; 
							case 'section8' : showSection8(); break; 
							case 'section9' : showSection9(); break; 
						}
					}
				})
			}
			,{
				root: null,
				threshold: threshold,
				rootMargin:"-30px"
			}
		)
	sections.forEach(section => {
		sectionObserver.observe(section);
	})

    /*
     * create the SVG and axes
     */
    buildPlotSpace();
	addAxes(); //showYear(years[years.length-2]);
}

function addLineAnnotations(region, description, offset){
    var regionYear = [];
    for (var idx=0; idx<yearData.length; idx++)
    	if (yearData[idx].region==region)
    		regionYear[regionYear.length] = yearData[idx];
    
    var regressionLine = ss.linearRegressionLine(ss.linearRegression(
    		regionYear.map((d) =>  { return [
		        calcAxisVal(yearXaxisScale, d, "gdp", 0),
		        calcAxisVal(yearYaxisScale, d, "tb", 0)
		    ];}
    	)));

    var x = xExtents[1]-100;
    var y = regressionLine(x);
    
    var annotations = [];
    annotations[annotations.length] = {
	    	note: {
	    		align: "middle",
	    		title: region,
	    		label: description,    		
//	    		wrapSplitter: /\n/
	    	},
	    	x: x,
	    	y: y,
	    	dx: offset.x,
	    	dy: offset.y
	    }

    d3.select("#annotations").call(d3.annotation().annotations(annotations));
}

function addAnnotations(config){
	var annotations = [];
	for (var idx=0; idx<config.length;idx++){
		var data = config[idx].data;
		
	    var element = d3.selectAll("#"+data.countryCode);
	    var x = +element.attr("cx"),
	        y = +element.attr("cy");
		
	    annotations[annotations.length] = {
	    	note: {
	    		align: "middle",
	    		title: data.name,
	    		label: data.tb + ' cases per 100,000\n$'+d3.format(",.3r")(data.gdp)+' per capita',    		
	    		wrapSplitter: /\n/
	    	},
	    	x: x,
	    	y: y,
	    	dx: config[idx].position[0],
	    	dy: config[idx].position[1]
	    }
	}

    d3.select("#annotations").call(d3.annotation().annotations(annotations));
}
function removeAnnotations(){
	d3.select("#annotations").selectAll("g").remove();
}

function clearFilterSet(){
	filterSet = {
			region : [],
			tb : [],
			gdp : [],
			countryCode: []
		}
	d3.selectAll('.region-filter').property('checked', false);
	d3.selectAll('.tb-group-filter').property('checked', false);
	d3.selectAll('.gdp-group-filter').property('checked', false);
	d3.selectAll('.countryCode-filter').property('selected', false);
	
	removeRegionTrend();
	hideGuide(null,true);
}

function updateFilterSet(type, value){
	if (type=="countryCode"){
		var selectedCountryCodes = [];
		document.querySelectorAll("option.countryCode-filter").forEach((element)=>{
			if (element.selected)
				selectedCountryCodes[selectedCountryCodes.length] = element.value;
		})
		for (var idx=0 ; idx<filterSet.countryCode.length; idx++)
			if (!selectedCountryCodes.includes(filterSet.countryCode[idx]))
				hideGuide({ data: yearDataByCountryCode[filterSet.countryCode[idx]] },true);
		
		filterSet.countryCode = selectedCountryCodes;
	}
	else {
		if (filterSet[type].includes(value)){
			filterSet[type].splice(filterSet[type].indexOf(value),1);
			if (type=="region")
				removeRegionTrend(value);
		}
		else {
			filterSet[type].push(value);
			if (type=="region")
				showRegionTrend(regionNameMap[value]);
		}
	}
	
	if (filterSet.region.length==0 && filterSet.tb.length==0 && filterSet.gdp.length==0 && filterSet.countryCode.length==0){
		colorByRegion();
		removeRegionTrend();
		hideGuide(null,true);
	}
	else {
		setScatterColor( (d)=>{
								var show = (
									filterSet.region.includes(regionMap[d.region]) || 
									filterSet.gdp.includes(gdpGroupMap[d.gdpBin]) || 
									filterSet.tb.includes(tbGroupMap[d.tbBin]) ||
									filterSet.countryCode.includes(d.countryCode)
								);
								return show ? "region-"+regionMap[d.region] : "dull" ; 
							})
				.style("r", (d)=>{ 
								var show = (
										filterSet.region.includes(regionMap[d.region]) || 
										filterSet.gdp.includes(gdpGroupMap[d.gdpBin]) || 
										filterSet.tb.includes(tbGroupMap[d.tbBin]) ||
										filterSet.countryCode.includes(d.countryCode)
									);
								return show ? "4" : null; 
							})
							;
		for (var idx=0 ; idx<filterSet.countryCode.length; idx++)
			showGuide({ data: yearDataByCountryCode[filterSet.countryCode[idx]] });
//			showAdhocLabel(filterSet.countryCode[idx])
	}
}


/*
 *  utility functions 
 */
function showYear(data){
	loadYear(data) ; 
	showRegressionLine(); 
	showScatter(); 
	showConforming(); 
	addPopovers()
}

function calcAxisVal(logMethod, d, src, zeroVal){
  if (d[src]===null)
    return zeroVal;
  var result = logMethod(d[src]);
  if (isNaN(result))
    return zeroVal;
  return result;
}

function getMinMax(arr,arr2,yearIdx){
    var minVal = Number.MAX_VALUE;
    var maxVal = Number.MIN_VALUE;

    for (var yIdx=0; yIdx<arr.length;yIdx++){
        if (yearIdx!=undefined && yIdx!=yearIdx)
            continue;
        var values=arr[yIdx];
        var values2=arr2[yIdx];
        for (var vIdx=0; vIdx<values.length;vIdx++){
            if (values[vIdx]==null || values2[vIdx]==null)
                continue;
            if (values[vIdx]<minVal)
                minVal = values[vIdx];
            if (values[vIdx]>maxVal)
                maxVal = values[vIdx];
        }
    }
    if (minVal<=0)
        minVal = 0.5;
    return [minVal, maxVal];
}

function getBin(binPoints, value) {
  for (var idx=0;idx<binPoints.length;idx++)
    if (value<binPoints[idx])
      return idx+1;
  return binPoints.length;
}

function simpleBinPoints(values, binCount) {
  if (values.length<=(binCount-1))
    return values;

  var binPoint = [];
  var binSize = Math.floor(values.length/binCount);
  var sorted = values.slice().sort(function(a, b){return a-b});
  for (var idx=0; idx<binCount; idx++)
    binPoint[idx] = sorted[(1+idx)*binSize];
  return binPoint;
}

function lineDistance(record, regression){
    num = Math.abs(regression.b + regression.m*(calcAxisVal(yearXaxisScale, record, "gdp", 0)) - calcAxisVal(yearYaxisScale, record, "tb", 0))
    den = Math.sqrt(1+Math.pow(regression.m,2))
    return num/den;
}

/*
 * data loader
 */
const conformPt = 65;
const outlierPt = 95;

var yearData = [];
var currentYear;
var plottedPoints;
var regression;
var xExtents = [];
var yearYaxisScale;
var yearXaxisScale;
var divergingColorDistance;
var yearDataByCountryCode = {};
function loadYear(tgtYear){
    currentYear = tgtYear;

    const year = years.indexOf(tgtYear);
    yearYaxisScale  = d3.scaleLog().clamp(true).domain(getMinMax(SH_TBS_INCD,NY_GDP_PCAP_CD,year)).range([(scatterHeight-100),0]);
    yearXaxisScale = d3.scaleLog().clamp(true).domain(getMinMax(NY_GDP_PCAP_CD,SH_TBS_INCD,year)).range([0,(scatterWidth-100)]);

    yearData = [];

    var tbBins = simpleBinPoints(SH_TBS_INCD[year],10);
    var gdpBins = simpleBinPoints(NY_GDP_PCAP_CD[year],10);

    for (var idx=0; idx<countries.length ; idx++){
        var tbIncidence = SH_TBS_INCD[year][idx];
        var gdpPerCap = NY_GDP_PCAP_CD[year][idx];
        if (tbIncidence==null || gdpPerCap==null)
        	continue;
        
        ydIdx = yearData.length;
        yearData[ydIdx]               = countries[idx];
        yearData[ydIdx]["tb"]         = tbIncidence;
        yearData[ydIdx]["tbBin"]      = getBin(tbBins,tbIncidence);
        yearData[ydIdx]["gdp"]        = gdpPerCap;
        yearData[ydIdx]["gdpBin"]     = getBin(gdpBins,gdpPerCap);
        yearData[ydIdx]["popDensity"] = EN_POP_DNST[year][idx];
        
        yearDataByCountryCode[countries[idx].countryCode] = yearData[ydIdx];
    }
    plottedPoints = yearData.map((d) => { return [ calcAxisVal(yearXaxisScale, d, "gdp", 0),
                                                            calcAxisVal(yearYaxisScale, d, "tb", 0)   ];})
    var maxX = Number.MIN_VALUE;
    var minX = Number.MAX_VALUE;
    for (var idx=0;idx<plottedPoints.length;idx++){
        if(plottedPoints[idx][0]>maxX)
            maxX = plottedPoints[idx][0];
        if(plottedPoints[idx][0]<minX)
            minX = plottedPoints[idx][0];
    }
    xExtents = [minX,maxX];
    
    regression = ss.linearRegression(plottedPoints);
    
    var maxDistance = Number.MIN_VALUE;
    var numClose = 0;
    for (var idx = 0; idx< yearData.length;idx++){
    	var distance = lineDistance(yearData[idx], regression);
        if (distance<=65)
            numClose++;
        
        if (yearData[idx].tb!=null && yearData[idx].gdp!=null && distance>maxDistance)
        	maxDistance=distance;
        
        yearData[idx]["distance"]   = distance;
        yearData[idx]["conforming"] = distance < conformPt;
        yearData[idx]["outlier"]    = distance > outlierPt;
    }
    divergingColorDistance = d3.scaleSequential().domain([0,(maxDistance-outlierPt)/2+outlierPt]).interpolator(d3.interpolate("yellow","blue"));
    
    console.log(numClose/yearData.length)
}

/*
 * chart rendering functions
 */
var scatterYaxisScale;
var scatterXaxisScale;
function buildPlotSpace(){
	scatterYaxisScale  = d3.scaleLog().clamp(true).domain(getMinMax(SH_TBS_INCD,NY_GDP_PCAP_CD)).range([(scatterHeight-100),0]);
	scatterXaxisScale = d3.scaleLog().clamp(true).domain(getMinMax(NY_GDP_PCAP_CD,SH_TBS_INCD)).range([0,(scatterWidth-100)]);
	
	var svg = d3.select("#scatterplot").append("svg").attr("id", "plotSpace").attr("height", scatterHeight).attr("width", scatterWidth)
	
	svg.append("g").attr("class", "guideWrapper")
		.attr("transform", "translate(50,50)");
	
	svg.append("g")
		.attr("id","scatterBody")
		.attr("transform","translate(50,50)");
	
	svg.append("g").attr("transform", "translate(50,50)")
		.attr("id","regLinearRegressionLine")

	svg.append("g").attr("transform", "translate(50,50)")
		.attr("id","annotations")

}

function removeAxes(){
	d3.select("#yAxis").remove();
	d3.select("#yAxisText").remove();
	d3.select("#xAxis").remove();
	d3.select("#xAxisText").remove();
}

function addAxes(){
	var svg = d3.select("#plotSpace");
	if(!d3.select("#yAxis").empty())
		return;
	
	//y-axis
	svg.append("g")
		.attr("id","yAxis")
		.attr("transform","translate(50,50)")
		.attr("fill","none")
		.call(
		  d3.axisLeft(scatterYaxisScale)
		    .tickValues([1,2,5,10, 20, 50, 100,200,500,1000])
		    .tickFormat(d3.format("~s"))
		  );

	// text label for the y-axis
	svg.append("text")
		.attr("id","yAxisText")
		.attr("class","legend")
		.attr("transform", "rotate(-90)")
		.attr("y", 0)
		.attr("x",0 - (scatterHeight / 2))
		.attr("dy", "1em")
		.style("text-anchor", "middle")
		.text("Incidence of tuberculosis (per 100,000 people)");
	
	//x-axis
	svg.append("g")
		.attr("id","xAxis")
		.attr("transform","translate(50,"+(scatterHeight-50)+")")
		.attr("fill","none")
		.call(
		    d3.axisBottom(scatterXaxisScale)
		      .tickValues([200,500,1000,2000,5000,10000,20000,50000,100000,200000])
		      .tickFormat(d3.format("~s"))
		);
	// text label for the x axis
	svg.append("text")
		.attr("id","xAxisText")
		.attr("class","legend")
		.attr("transform",
		    "translate(" + (scatterWidth/2) + "," + (scatterHeight-5) + ")")
		.style("text-anchor", "middle")
		.text("GDP per capita (current US$)");
}

function removeRegressionLine(){
    d3.select("#linearRegressionLine line")
    .transition().duration(800).style("stroke-opacity",.0).on("end", function() {
    	this.parentNode.remove();
    });
}

function removeRegionTrend(region){
	if (region==null)
		d3.selectAll("#regLinearRegressionLine line").remove();
	else
		d3.select("#regLinearRegressionLine_"+region).remove();
}

function showRegionTrend(region){
    var regionYear = [];
    for (var idx=0; idx<yearData.length; idx++)
    	if (yearData[idx].region==region)
    		regionYear[regionYear.length] = yearData[idx];
    
    var regressionLine = ss.linearRegressionLine(ss.linearRegression(
    		regionYear.map((d) =>  { return [
		        calcAxisVal(yearXaxisScale, d, "gdp", 0),
		        calcAxisVal(yearYaxisScale, d, "tb", 0)
		    ];}
    	)));

    var svg = d3.select("#regLinearRegressionLine");
    svg.append("line")
    	.attr("id","regLinearRegressionLine_"+regionMap[region])
        .attr("class","region-"+regionMap[region]+"-reg")
        .style("stroke-width","2px")
        .style("stroke-opacity",.0)
        .attr("x1", xExtents[0])
        .attr("y1", regressionLine(xExtents[0]))
        .attr("x2", xExtents[1])
        .attr("y2", regressionLine(xExtents[1]))
        .transition().duration(1200).style("stroke-opacity",0.2)
    ;
}

function showRegressionLine(){
	removeRegressionLine();
	
    var regressionLine = ss.linearRegressionLine(regression);

    var svg = d3.select("#plotSpace");
    svg.append("g") .attr("transform", "translate(50,50)")
        .attr("id","linearRegressionLine")
        .append("line")
        .style("stroke","lightgrey")
        .style("stroke-width","2px")
        .style("stroke-opacity",.0)
        .attr("x1", xExtents[0])
        .attr("y1", regressionLine(xExtents[0]))
        .attr("x2", xExtents[1])
        .attr("y2", regressionLine(xExtents[1]))
        .transition().duration(1200).style("stroke-opacity",.8)
    ;
}

function removeColor() {
	setScatterColor( ()=>{ return "dull" });
}
function showConforming() {
	setScatterColor(   (d)=>{ return d.conforming ?  "notdull" : "dull"; })
		.style("fill", (d)=>{ return d.conforming ? divergingColorDistance(d.distance) : null; });;
}
function showOutliers() {
	setScatterColor(   (d)=>{ return d.outlier ? "notdull" : "dull"; })
		.style("fill", (d)=>{ return d.outlier ? divergingColorDistance(d.distance) : null; });
}

function colorGdpBins(bins){
	setScatterColor(   (d)=>{ return bins.includes(d.gdpBin) ? "notdull" : "dull" ; })
		.style("fill", (d)=>{ return bins.includes(d.gdpBin) ? divergingColorDistance(d.distance) : null;	});
}

function colorTbBins(bins){
	setScatterColor(   (d)=>{ return bins.includes(d.tbBin) ? "notdull" : "dull" ; })
		.style("fill", (d)=>{ return bins.includes(d.tbBin) ? divergingColorDistance(d.distance) : null;	});
}

function colorByRegion() {
	setScatterColor((d)=>{return "region-"+regionMap[d.region]; });
}

function setScatterColor(colorFunc){
	return d3.select("#scatterBody").selectAll("circle").data(yearData).attr("class" , colorFunc ).attr("style",null);
}
function setScatterTitle(text){
	d3.select("#scatterTitle").text(text);
}
function setScatterSubTitle(text){
	d3.select("#scatterSubTitle").text(text);
}

function showScatter() {
    //remove existing circles
    d3.select("#scatterBody").selectAll("circle").remove();
    d3.select("#scatterBody").selectAll("text").remove();

    d3.select("#scatterBody").append("text")
        .attr("class","h2")
        .attr("id", "scatterTitle")
	    .attr("transform", "translate(" + ((scatterWidth-100)/2) + ",0)")
        .style("text-anchor", "middle");
    
    d3.select("#scatterBody").append("text")
	    .attr("class","h4")
	    .attr("id", "scatterSubTitle")
	    .attr("transform", "translate(" + ((scatterWidth-100)/2) + ",20)")
	    .style("text-anchor", "middle");
    
    
    d3.select("#scatterBody").selectAll("circle")
        .data(yearData)
            .enter()
              .append("circle")
                .attr("id", (d) => { return d.countryCode; })
                .attr("cx", (d,idx) => { return calcAxisVal(scatterXaxisScale, d, "gdp", 0) })
                .attr("cy", (d,idx) => { return calcAxisVal(scatterYaxisScale, d, "tb", (scatterHeight-50)) })
                .attr("r", 0)
                .attr("data",(d) => { return JSON.stringify(d); })
                .attr("class","basecircle")
                .transition().delay(300)
	                .attr("r",(d,idx) => { return (d.gdp === null || d.tb === null) ? 0 : 3 ;})
    ;
}

function removePopovers() {
    d3.select("#scatterBody")
    .selectAll("path").remove();
}

function addPopovers() {
	removePopovers();
	
    var voronoi = d3.voronoi()
        .x((d) => { return calcAxisVal(scatterXaxisScale, d, "gdp", 0) })
        .y((d) => { return calcAxisVal(scatterYaxisScale, d, "tb", (scatterHeight-50)) })
        .extent([[0, 0], [scatterWidth-100, scatterHeight-100]]);

    d3.select("#scatterBody")
        .selectAll("path")
            .data(voronoi.polygons(yearData)) 
                .enter()
                    .append("path")
                    .style("stroke", "none")
                    .style("fill", "none")
                    .style("pointer-events", "all")
                    .attr("d", (d,i) => { return (d==null) ? "M0,0Z" : "M" + d.join("L") + "Z"; })
                    .on("mouseover", showGuide)
                    .on("mouseout",  () => { hideGuide(null,false); });
}

function loadCountries(){
	if (yearData != null){
		var dropdown = d3.select("#sel-country");
		dropdown.selectAll("option").remove();
		dropdown.selectAll("option")
			 .data(yearData)
			 .enter()
				 .append("option")
				 .text((d)=> { return d.name; })
				 .attr("value", (d)=> { return d.countryCode; })
				 .attr("class", "countryCode-filter")
				 ;
	}
}

function showOrientingLabels(region){
	var delayIdx = 0;
	for (var idx=0;idx<yearData.length;idx++){
	    var element = d3.selectAll("#"+yearData[idx].countryCode);
	    var x = +element.attr("cx"),
	        y = +element.attr("cy")
		
		delayIdx+=1;
	    
	    d3.select("#scatterBody")
    	.append("text")
        .attr("id", countries[idx].countryCode+"-orient-label")
        .attr("x", x+5)
        .attr("y", y-3)
        .attr("class","orient-label")
        .style("pointer-events", "none")
        .style("opacity",0)
        .text(yearData[idx].name)
        .transition().delay(delayIdx*600)
        	.style("opacity",1.0)
        		.transition().delay(1200)
        			.style("opacity",0)
        				.remove();
	}
}

function removeOrientingLabels(){
	d3.selectAll(".orient-label").remove();
}

function showGuide(d) {
	showGuideHint = false;
	hideGuide();
	d3.select("#hoverHint").transition().delay(500).style("opacity",0).remove()
	
    //populate tooltip and show
    if(d3.select("#"+d.data.countryCode+"-guide").empty()){
	    //get location info for tooltip
	    var element = d3.selectAll("#"+d.data.countryCode);
	    var x = +element.attr("cx"),
	        y = +element.attr("cy");
	    
//	    var color = element.style("fill");
//	    if (color == "#FFFFFF" || color == "rgb(255, 255, 255)")
	    var	color = "lightgrey";
	    
	    d3.select("#scatterBody").append("text")
	        .attr("id", d.data.countryCode+"-guide")
	        .attr("countryCode",d.data.countryCode)
	        .attr("selected",filterSet.countryCode.includes(d.data.countryCode))
	        .attr("class","guideEl guideText")
	        .attr("x", x+3)
	        .attr("y", y-3)
	        .text(d.data.name)
	        .style("pointer-events", "none")
	        .style("opacity",0)
	        .transition().duration(300)
	        .style("opacity", 1);

	    //draw guidelines
	    var wrapper = d3.selectAll(".guideWrapper");
	    //vertical line
	    wrapper.append("line").attr("class", "guideEl guide")
	    	.attr("id",d.data.countryCode+"-xguide")
	        .attr("countryCode",d.data.countryCode)
	        .attr("selected",filterSet.countryCode.includes(d.data.countryCode))
	        .attr("x1", x).attr("y1", y)
	        .attr("x2", x).attr("y2", scatterHeight-125)
	        .style("stroke", color)
	        .style("opacity",  0)
	        .transition().duration(200)
	        .style("opacity", 0.5);
	    //horizontal line
	    wrapper.append("line").attr("class", "guideEl guide")
	    	.attr("id",d.data.countryCode+"-yguide")
	        .attr("countryCode",d.data.countryCode)
	        .attr("selected",filterSet.countryCode.includes(d.data.countryCode))
	        .attr("x1", x).attr("y1", y)
	        .attr("x2", 30).attr("y2", y)
	        .style("stroke", color)
	        .style("opacity",  0)
	        .transition().duration(200)
	        .style("opacity", 1.0);
	
	    //write values on axis
	    //Value on the x-axis
	    wrapper.append("text").attr("class", "guideEl guide legend region-"+regionMap[d.data.region])
	    	.attr("id",d.data.countryCode+"-xtext")
	        .attr("countryCode",d.data.countryCode)
	        .attr("selected",filterSet.countryCode.includes(d.data.countryCode))
	        .attr("x", x)
	        .attr("y", scatterHeight-120)
	        .attr("dy", "0.71em")
	        .style("opacity",  0)
	        .style("text-anchor", "middle")
	        .text(d3.format(".2s")(d.data.gdp) )
	        .transition().duration(200)
	        .style("opacity", 0.5);
	
	    //Value on the y-axis
	    wrapper.append("text").attr("class", "guideEl guide legend region-"+regionMap[d.data.region])
	    	.attr("id",d.data.countryCode+"-ytext")
	        .attr("countryCode",d.data.countryCode)
	        .attr("selected",filterSet.countryCode.includes(d.data.countryCode))
	        .attr("x", 25).attr("y", y)
	        .attr("dy", "0.32em")
	        .style("background-color","white")
	        .style("opacity",  0)
	        .style("text-anchor", "end")
	        .text( d.data.tb )
	        .transition().duration(200)
	        .style("opacity", 1.0);
    }
}

function hideGuide(d,deselect) {
	if (d == null){
		if (deselect)
			d3.selectAll(".guideEl").remove();
		else
			d3.selectAll(".guideEl[selected=false]").remove();
	}
	else if (deselect)
	    d3.selectAll(".guideEl[countryCode="+d.data.countryCode+"]").remove();
	else
	    d3.selectAll(".guideEl[countryCode="+d.data.countryCode+"][selected=false").remove();
}

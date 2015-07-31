var DataStore = require('./DataStore.js');

/* Variables */
var

// jQuery objects

$game = $("#game"),
$gameInput = $("#game-input"),
$gameSelect = $("#game-select"),

$xInput = $("#x-input"),
$yInput = $("#y-input"),
$xWindow = $(".axis-window.x"),
$yWindow = $(".axis-window.y"),
$xPanel = $(".axis-panel.x"),
$yPanel = $(".axis-panel.y"),

$plot = $("#plot"),
$plotWrap = $("#plot-wrap"),
$pointReport = $("#point-report"),
$pointReportHead = $("#point-report-head"),
$pointReportBody = $("#point-report-body"),
$pointReportBallX = $("#point-report-ball-x"),
$pointReportBallY = $("#point-report-ball-y"),
$sliceLineLeader = $("#slice-line-leader"),
$deleteSlice = $("#delete-slice"),
$sliceButton = $("#slice-button"),
$sliceGridPoints = $("#slice-grid-points"),

$dateSlider = $("#date-slider"),
$dateSliderLower = $("#date-slider-handle-lower"),
$dateSliderUpper = $("#date-slider-handle-upper"),
$dateCount = $("#date-count"),
$dateLockInput = $("#date-lock-input"),

$trajectoryToggle = $("#trajectory-toggle"),

$quickpickButton = $("#quickpick-button"),
$quickpickNumbers = $("#quickpick-numbers"),

// d3 objects

d3$plot = d3.select("#plot"),
d3$pointsGroup = d3.select("#points"),
d3$multipointsGroup = d3.select("#multipoints"),
d3$gridPointsGroup = d3.select("#grid-points"),
d3$sliceGridPointsGroup = d3.select("#slice-grid-points"),
d3$slicesGroup = d3.select("#slices"),
d3$sliceLinesGroup = d3.select("#slice-lines"),
d3$linesGroup = d3.select("#lines"),
d3$quickpickPointsGroup = d3.select("#quickpick-points"),
d3$quickpickNumbersContainer = d3.select("#quickpick-numbers"),
d3$pointReport = d3.select("#point-report"),
d3$pointReportBody = d3.select("#point-report-body"),

// Data

gameData,
gameInfo,
sliceData,

// Other

ballWindow = $(".axis-window").height(),
sliceMode,
trajectoryMode,
dateLocked,
dateRange,
slicePoints,
quickpicks,
xDimension,
yDimension,
xScale,
yScale,
svgToPixel,
rGrid,
rSliceGrid,
rMin,
rMax,
rQuickpick;



/* General */



// Close all menus
$(document).on("mouseup", function(e) {
  // Close game dropdown when anything except the dropdown select and its children are clicked
  if ( !$gameSelect.is(e.target) && $gameSelect.has(e.target).length === 0 ) {
    $gameInput.prop( "checked", false );
  }
  // Close x-axis-window when anything except the x-axis panel select and its children are clicked
  if ( !$xPanel.is(e.target) && $xPanel.has(e.target).length === 0 ) {
    $xInput.prop( "checked",false );
  }
  // Close y-axis-window when anything except the y-axis panel select and its children are clicked
  if ( !$yPanel.is(e.target) && $yPanel.has(e.target).length === 0 ) {
    $yInput.prop( "checked",false );
  }

});

// Toggle game dropdown when arrow is clicked
$("#game-dropdown-arrow").on("click", function() {
  $gameInput.prop( "checked", !$gameInput.prop("checked") );
});

// Pad the specified number with zeros.
// Returns a string representation of the given number,
// which may be provided as an integer or a string.
// The overall width of the returned string should be an integer.
function padNumber ( number, width ) {
  var zeros = Array( width + 1 ).join( "0" );
  return ( zeros + number ).slice( -width );
}



/* On game change */



$game.on( "change", "#pb-input, #mm-input", function() {
  changeGame( $("input[name=games]:checked").val() );
});

// Change game
function changeGame( gameCode ) {
  // Get game data and info
  gameData = DataStore[gameCode]["data"];
  gameInfo = DataStore[gameCode]["info"];
  
  // Initialize slice data as empty for now
  // When database stores slice data, this data would be retrieved instead
  sliceData = {}
  var sliceDataSize = gameInfo["number-count"] + gameInfo["bonus-count"];
  for (var i = 0; i < sliceDataSize; i++) {
    sliceData[i] = {};
    for (var j = i; j <= sliceDataSize; j++) {
      sliceData[i][j] = [];
    }
  }

  setScales();
  dateLocked = false;
  $dateLockInput.prop( "checked", false )
    updateDateSlider();
  bindData();

  xDimension = 1;
  yDimension = 0;
  $(".axis-panel.x").css({ "left": -ballWindow });
  $(".axis-panel.y").css({ "top": 0 });
  projectPoints();

  trajectoryMode = 0;
  $trajectoryToggle.find( "#trajectory-off" ).prop( "checked", true );
  drawLines();
  drawGrid();

  quickpicks = [];
  updateQuickpicks();
  drawQuickpickPoints();

  sliceMode = 0;
  slicePoints = [];
  cancelSlicing();
  drawSliceGrid();
  drawSlices();

}



// Set scales of plot axes and point radii
function setScales() {
  // Plot max and min values are fixed per game
  var minNumber = Math.min(gameInfo["number-range"][0],gameInfo["bonus-range"][0]),
      maxNumber = Math.max(gameInfo["number-range"][1],gameInfo["bonus-range"][1]);

  // Scale the svg plot to the range of lottery numbers
  // d3 scales are functions that accept domain numbers
  xScale = d3.scale.linear().domain([minNumber - 1, maxNumber + 1]).range([0,100]);
  yScale = d3.scale.linear().domain([minNumber - 1, maxNumber + 1]).range([100,0]);
  svgToPixel = d3.scale.linear().domain([0,100]).range([0,$plot.outerWidth()]);

  // Radii of grid points
  rGrid = xScale(1) / 6;
  rSliceGrid = xScale(1)/ 5;
  rMin = xScale(1) / 3;
  rMax = xScale(1) / 2;
  rQuickpick = xScale(1) / 1.7;
}



// Bind data to points
function bindData( sliderValues ) {
  // get slider values from slider, if not they are not provided
  sliderValues = (typeof sliderValues === "undefined") ? $dateSlider.slider("values") : sliderValues;

  // bind data to plot points
  var d3$points = d3$pointsGroup.selectAll( ".single-point" ).data( gameData.slice( parseInt(sliderValues[0]), parseInt(sliderValues[1]) + 1 ) );
  // Merge entering selection into update selection
  d3$points.enter().append( "circle" ).classed( "single-point", true );
  // Remove exit selection
  d3$points.exit().remove();
}



// Project points onto xDimension and yDimension
function projectPoints() {
  // Object for recording overlapping points
  // Each key represents a value along one of the dimensions.
  // Use object/keys instead of array/indexes because some
  // value pairs may have no data (sparse).
  var overlap = {};

  // Process and draw single points
  d3$pointsGroup.selectAll( ".single-point" )
                .each( function(d) {
                  // record overlapping points
                  key1 = d["numbers"][xDimension];
                  key2 = d["numbers"][yDimension];
                  if ( ! ( key1 in overlap ) ) {
                    overlap[key1] = {};
                  }
                  if ( !( key2 in overlap[key1] ) ) {
                    overlap[key1][key2] = [];
                  }
                  overlap[key1][key2].push(d);

                  // draw single points
                  drawPoint( d3.select(this), [d] );
                });

  // "Multipoints" represent overlapping single points

  // Organize point-overlap data
  var multipointData = [];
  Object.keys( overlap ).forEach( function(key1) {
    Object.keys( overlap[key1] ).forEach( function(key2) {
      if ( overlap[key1][key2].length > 1 ) { //more than one item at this point
                                              multipointData.push( overlap[key1][key2] );
      }
    });
  });

  // Note: multipoints need to be rebound each time a dimension is changed
  // because multipoint data depends on how points overlap in a specific projection
  var d3$multipoints = d3$multipointsGroup.selectAll( ".multi-point" ).data( multipointData );

  // merge entering selection into update selection
  d3$multipoints.enter().append( "circle" ).classed( "multi-point", true );

  // remove exit selection
  d3$multipoints.exit().remove();

  // draw multipoints for update selection
  d3$multipoints.each( function(d) {
    drawPoint( d3.select(this), d );
  });
}



// Draw the point d3$point for the given datum d.
// Point is drawn projected onto the current dimensions.
// This function is used by both points and multipoints.
function drawPoint( d3$point, d ) {
  d3$point
        .attr( "cx", xScale(d[0]["numbers"][xDimension]) )
        .attr( "cy", yScale(d[0]["numbers"][yDimension]) )
        .attr( "r", rMax + (rMin - rMax) * Math.exp( -(d.length-1)/4 ) )
        .on("mouseover", function() {
          var xrel = svgToPixel(xScale(d[0]["numbers"][xDimension]));
          var yrel =  svgToPixel(yScale(d[0]["numbers"][yDimension]));
          $pointReport.css({
            "left": xrel - $pointReport.outerWidth() / 2,
            "top": yrel - $pointReportHead.outerHeight() - 10
          });

          // set point report dimension number and ball number
          var xDimensionText, yDimensionText;
          if ( xDimension >= gameInfo["number-count"] ) {
            xDimensionText = "Bonus";
            $pointReportBallX.toggleClass( "bonus", true );
          } else {
            xDimensionText = "#" + ( xDimension+1 );
            $pointReportBallX.toggleClass( "bonus", false );
          }
          if ( yDimension >= gameInfo["number-count"] ) {
            yDimensionText = "Bonus";
            $pointReportBallY.toggleClass( "bonus", true );
          } else {
            yDimensionText = "#" + ( yDimension+1 );
            $pointReportBallY.toggleClass( "bonus", false );
          }
          $pointReportHead.find("#point-report-dimension-x").text( xDimensionText );
          $pointReportHead.find("#point-report-dimension-y").text( yDimensionText );
          $pointReportBallX.text( padNumber( d[0]["numbers"][xDimension], 2 ) );
          $pointReportBallY.text( padNumber( d[0]["numbers"][yDimension], 2 ) );

          $pointReportHead.show();
        })
        .on("mouseleave", function() {
          if ($pointReportBody.is(":hidden")) {
            $pointReportHead.hide();
          }
        })
        .on("click", function() {
          // bind data to point report body items
          d3$pointReportBodyItems = d3$pointReportBody.selectAll( ".point-report-body-item" ).data( d );

          // build report body items for enter selection
          d3$pointReportBodyItems.enter().append("div").classed( "point-report-body-item", true )
          .each( function(d) {
              d3.select(this).append( "span" ).classed( "point-report-date", true );
              d3.select(this).append( "span" ).classed( "point-report-numbers", true );
              d3.select(this).append( "span" ).classed( "point-report-bonus", true );
          });
          
          // remove exit selection
          d3$pointReportBodyItems.exit().remove();

          // update point report dates and numbers
          d3$pointReportBodyItems
            .each( function(d) {
              d3.select(this).selectAll( ".point-report-date" ).text( d["date"] );
              d3.select(this).selectAll( ".point-report-numbers" ).text( function() {
                var numbers = [];
                for ( var i = 0; i < gameInfo["number-count"]; i++ ) {
                  numbers.push( padNumber( d["numbers"][i], 2 ) );
                }
                return numbers.join(" ");
              });
              d3.select(this).selectAll( ".point-report-bonus" ).text( function() {
                var bonus = [];
                for ( var i = gameInfo["number-count"]; i < gameInfo["number-count"] + gameInfo["bonus-count"]; i++ ) {
                  bonus.push( padNumber( d["numbers"][i], 2 ) );
                }
                return bonus.join(" ");
              });
            });
          $pointReportBody.show();
        });
}



// Draw trajectory lines (time course) between points
function drawLines( sliderValues ) {
  // get slider values from slider, if not they are not provided
  sliderValues = (typeof sliderValues === "undefined") ? $dateSlider.slider("values") : sliderValues;

  var lineData = [];
  if ( trajectoryMode === 1 ) { //trajectory mode is on
                                var pointData = gameData.slice( parseInt(sliderValues[0]), parseInt(sliderValues[1]) + 1 );
    for ( var i = 1; i < pointData.length; i++ ) {
      lineData.push( [pointData[i], pointData[i-1]] );
    }
  }
  var d3$lines = d3$linesGroup.selectAll( ".line" ).data( lineData );

  // Merge entering selection into update selection
  d3$lines.enter().append( "line" ).classed( "line", true );

  // Remove exit selection
  d3$lines.exit().remove();

  d3$lines
        .attr( "x1", function(d) {
          return xScale( d[0]["numbers"][xDimension] );
        })
        .attr( "y1", function(d) {
          return yScale( d[0]["numbers"][yDimension] );
        })
        .attr( "x2", function(d) {
          return xScale( d[1]["numbers"][xDimension] );
        })
        .attr( "y2", function(d) {
          return yScale( d[1]["numbers"][yDimension] );
        });
}


// Draw grid points.
function drawGrid() {
  var xRange = xDimension < gameInfo["number-count"] ? gameInfo["number-range"] : gameInfo["bonus-range"];
  var yRange = yDimension < gameInfo["number-count"] ? gameInfo["number-range"] : gameInfo["bonus-range"];
  var gridData = [];
  for (var i = xRange[0]; i < xRange[1] + 1; i++) {
    for (var j = yRange[0]; j < yRange[1] + 1; j++) {
      gridData.push([i,j]);
    }
  }
  var d3$gridPoints = d3$gridPointsGroup.selectAll( ".grid-point" ).data( gridData );

  // add entering grid points
  d3$gridPoints.enter().append( "circle" ).classed("grid-point", true);

  // remove exit selection
  d3$gridPoints.exit().remove();

  // redraw update selection
  d3$gridPoints
        .attr( "cx", function(d) { return xScale(d[0]); } )
        .attr( "cy", function(d) { return yScale(d[1]); } )
        .attr( "r", rGrid )
        .attr( "fill", "#ccc");
}



// Draw slice grid points
function drawSliceGrid() {
  var xRange = xDimension < gameInfo["number-count"] ? gameInfo["number-range"] : gameInfo["bonus-range"];
  var yRange = yDimension < gameInfo["number-count"] ? gameInfo["number-range"] : gameInfo["bonus-range"];
  var sliceGridData = [];
  for (var i = xRange[0]; i < xRange[1] + 1; i++) {
    for (var j = yRange[0]; j < yRange[1] + 1; j++) {
      sliceGridData.push({
        "xy": [i,j],
        "used": false
      });
    }
  }
  var d3$sliceGridPoints = d3$sliceGridPointsGroup.selectAll(".slice-grid-point").data( sliceGridData );
  // append slice grid points
  d3$sliceGridPoints.enter().append( "circle" ).classed("slice-grid-point", true);
  // remove exit selection
  d3$sliceGridPoints.exit().remove();
  // redraw update selection
  d3$sliceGridPoints
        .attr( "cx", function(d) { return xScale(d["xy"][0]); } )
        .attr( "cy", function(d) { return yScale(d["xy"][1]); } )
        .attr( "r", rSliceGrid )
        .on( "mouseover", function(d) {
          d3.select(this)
            .attr( "r", rMin )// enlarge point
            .classed( "slice-path-point", true );//darken point
        })
        .on( "mouseout", function(d) {
          // reset point appearance, if point is not part of the slice path
          if ( !d["used"] ) {
            d3.select(this)
              .attr( "r", rSliceGrid )// shrink point
              .classed( "slice-path-point", false );//lighten point
          }
        })
        .on( "click", function(d) {
          if ( slicePoints.length == 0 ) {
            // add first point to slice path
            d3.select( this ).each( addSlicePoint );
          }
          else if ( slicePoints.length == 1 && d["xy"][0] == slicePoints[0][0] && d["xy"][1] == slicePoints[0][1] ) {
            // remove first point from slice path
            d3.select( this ).each( removeSlicePoint );
            // hide slice line leader
            $sliceLineLeader.hide();
          }
          else {
            var lastPoint = slicePoints[slicePoints.length - 1];

            // Clicked point equals first point
            if ( d["xy"][0] == slicePoints[0][0] && d["xy"][1] == slicePoints[0][1] ) {
              // Reject this point if current line segment intersects any line segment
              // defined by slicePoints, except the first and last.
              // Also reject if this point would form a 2-sided polygon.
              if ( lineIntersectsPath( lastPoint, d["xy"], slicePoints.slice(1,-1) ) ||
                   slicePoints.length == 2 ) {
                     flashSliceLineLeader();
                     return false;
              }
              // create key for this slice (use timestamp for now)
              var sliceKey = new Date().getTime();

              // add slice path to slice data, smaller dimension first
              if ( xDimension > yDimension ) {
                // flip x and y before saving
                var slicePointsInverted = [];
                for (var i = 0; i < slicePoints.length; i++ ) {
                  slicePointsInverted.push( [ slicePoints[i][1], slicePoints[i][0] ] );
                }
                sliceData[yDimension][xDimension].push({
                  "id": sliceKey,
                  "points": slicePointsInverted
                });
              } else {
                sliceData[xDimension][yDimension].push({
                  "id": sliceKey,
                  "points": slicePoints.slice() //copy
                });
              }

              // draw slices on plot
              drawSlices();

              // exit slicing mode
              toggleSliceMode();
              cancelSlicing();
            }
            // Clicked point equals previous point
            else if ( d["xy"][0] == lastPoint[0] && d["xy"][1] == lastPoint[1] ) {
              // remove clicked point from slice path
              d3.select( this ).each( removeSlicePoint );
              // undraw last line
              $plot.find(".slice-line").eq(-2).remove();
              // hide slice line leader
              $sliceLineLeader.hide();
            }
            // Clicked point would create a line that intersects the existing slice path.
            else if ( lineIntersectsPath( lastPoint, d["xy"], slicePoints.slice(0,-1) ) ) {
              flashSliceLineLeader();
              return false;
            }
            // Clicked point should be added to slice path
            else {
              // add clicked point to slice path
              d3.select( this ).each( addSlicePoint );
              // draw line to clicked point
              var $lineClone = $sliceLineLeader.clone();
              $sliceLineLeader.hide();
              $lineClone.removeAttr( "id" )
                        .attr( "x2", xScale(d["xy"][0]) )
                        .attr( "y2", yScale(d["xy"][1]) )
                        .insertBefore( $sliceLineLeader );
            }
          }
        });
}



// Add point to slice path. d is the point's datum.
function addSlicePoint(d) {
  // mark point used
  d["used"] = true;
  // enlarge point
  $(this).attr( "r", rMin );
  // store point
  slicePoints.push( d["xy"] );
}



// Remove point from slice path.
// "d" is the point's datum and "this" is the point
function removeSlicePoint(d) {
  // remove point
  if ( slicePoints.length > 0 ) {
    slicePoints.pop();
  }
  d3.select(this)
                  .attr( "r", rSliceGrid )// shrink point
                  .classed( "slice-path-point", false );//lighten point
  // mark point as unused
  d["used"] = false;
}



// Gets slice data for the current x and y dimensions.
// If xDimension is larger than yDimension, points are swapped.
function getSliceData() {
  if ( xDimension > yDimension ) {
    var sliceDataAdjusted = [];
    // flip x and y before using
    var sliceDataAdjusted = [];
    for (var i = 0; i < sliceData[yDimension][xDimension].length; i++ ) {
      var sliceDataPointsAdjusted = [];
      for (var j = 0; j < sliceData[yDimension][xDimension][i]["points"].length; j++ ) {
        sliceDataPointsAdjusted.push( [ sliceData[yDimension][xDimension][i]["points"][j][1],
                                        sliceData[yDimension][xDimension][i]["points"][j][0] ]
        );
      }
      sliceDataAdjusted.push({
        "id": sliceData[yDimension][xDimension][i]["id"],
        "points": sliceDataPointsAdjusted
      });
    }
    return sliceDataAdjusted;
  } else {
    return sliceData[xDimension][yDimension];
  }
}



// Draw slices
function drawSlices() {
  var d3$slices = d3$slicesGroup.selectAll( ".slice" )
                                .data( getSliceData(), function(d) { return d["id"]; } );

  d3$slices.enter().append( "polygon" )
           .classed( "slice", true )
           .attr("points", function(d) {
             var polygonPoints = [];
             for ( var i = 0; i < d["points"].length; i++ ) {
               polygonPoints.push( xScale( d["points"][i][0] ) + "," + yScale( d["points"][i][1] ) );
             }
             return polygonPoints.join(" ");
           })
           .on("mouseover", function() {
             d3.select(this).classed( "slice-hover", true );
           })
           .on("mouseleave", function() {
             if ($deleteSlice.is(":hidden")) {
               d3.select(this).classed( "slice-hover", false );
             }
           })
           .on("click", function(d) {
             // Center delete slice button over slice
             var xrel = d3.event.pageX - $plot.offset().left;
             var yrel = d3.event.pageY - $plot.offset().top;
             $deleteSlice.css({
               "left": xrel - $deleteSlice.outerWidth() / 2,
               "top": yrel - $deleteSlice.outerHeight() / 2
             });
             // Attach polygon id as datum
             d3.select("#delete-slice").datum( d["id"] );
             $deleteSlice.show();
           });

  d3$slices.exit().remove();

  // Re-evaluate quickpicks
  testQuickpicks();
  updateQuickpicks();
  drawQuickpickPoints();
}



// Changing xDimension
$(".axis-window.x").on("mouseup", ".ball", function() {
  newXDimension = $(this).index();
  if ( xDimension !== newXDimension ) {
    xDimension = newXDimension;
    // shift x-axis panel horizontally when a ball is clicked
    $(this).parent().css({"left": - xDimension * ballWindow});
    projectPoints();
    drawLines();
    drawGrid();
    drawSliceGrid();
    drawSlices();
    drawQuickpickPoints();
  }
});

// Changing xDimension
$(".axis-window.y").on("mouseup", ".ball", function() {
  newYDimension = $(this).index();
  if ( yDimension !== newYDimension ) {
    yDimension = newYDimension;
    // shift y-axis panel vertically when a ball is clicked
    $(this).parent().css({"top": - yDimension * ballWindow});
    projectPoints();
    drawLines();
    drawGrid();
    drawSliceGrid();
    drawSlices();
    drawQuickpickPoints();
  }
});



/* Plot manipulation */



// Draw a line from the last point to current mouse position
function activateSliceLineLeader() {
  // bind plot to slice line leader
  d3$plot.on( "mousemove", function() { //"this" is the plot
                                        if ( slicePoints.length > 0 ) {
                                          var lastPoint = slicePoints[slicePoints.length - 1];
                                          $sliceLineLeader.attr( "x1", xScale(lastPoint[0]) );
                                          $sliceLineLeader.attr( "y1", yScale(lastPoint[1]) );
                                          $sliceLineLeader.attr( "x2", d3.mouse(this)[0] );
                                          $sliceLineLeader.attr( "y2", d3.mouse(this)[1] );
                                          // show slice line leader
                                          $sliceLineLeader.show();
                                        }
  });
}
function deactivateSliceLineLeader() {
  // hide slice line leader
  $sliceLineLeader.hide();
  // unbind plot from slice line leader
  d3$plot.on( "mousemove", null );
}



// Flash slice line leader
function flashSliceLineLeader() {
  $sliceLineLeader.attr( "class", "slice-line error" );
  window.setTimeout( function() {
    $sliceLineLeader.attr( "class", "slice-line" );
  }, 100);
}



// Show point report
$pointReport.on("mouseleave", function() {
  $pointReportHead.hide();
  $pointReportBody.hide();
});



// Delete slice
d3.select("#delete-slice")
  .on("mouseleave", function() {
    $deleteSlice.hide();
    // lighten fill of all slices
    d3.selectAll(".slice").classed( "slice-hover", false );
  })
  .on("click", function(d) {
    // Datum of delete-slice should be set to the polygon id; use it to delete polygon

    // delete object from slice data for current dimensions
    smallDimension = xDimension > yDimension ? yDimension : xDimension;
    largeDimension = xDimension > yDimension ? xDimension : yDimension;
    sliceData[smallDimension][largeDimension] = $.grep( sliceData[smallDimension][largeDimension],
                                                        function(el){ return el["id"] != d; } );

    drawSlices();

    // hide deleteSlice
    $deleteSlice.hide();

    // Re-evaluate quickpicks
    testQuickpicks();
    updateQuickpicks();
    drawQuickpickPoints();
  });



// Slice button
$sliceButton.on("click", function() {
  toggleSliceMode();
  if ( sliceMode === 0 ) { //slice mode is off
                           // exit slicing mode
                           cancelSlicing();
  } else { //slice mode is on
           $(this).text("Cancel");
    // show slice grid points
    $sliceGridPoints.show();
    // activate slice line leader
    activateSliceLineLeader();
  }
});

// Exit slicing mode
function cancelSlicing() {
  // change slice button text
  $sliceButton.text("Slice");
  // hide slice grid points
  $sliceGridPoints.hide();
  // erase all slice lines except leader
  $(".slice-line").not($sliceLineLeader).remove();
  // deactivate slice line leader
  deactivateSliceLineLeader();
  // remove all points from slice path
  d3$sliceGridPointsGroup.selectAll( ".slice-grid-point" ).each( removeSlicePoint );
}

// Toggle slice mode
function toggleSliceMode() {
  sliceMode = ( sliceMode + 1 ) % 2;
}



/* Geometric functions */



// Returns true if the line segments (x1,y1)(x2,y2) and (x3,y3)(x4,y4) intersect
// http://stackoverflow.com/questions/9043805/test-if-two-lines-intersect-javascript-function
function lineIntersection( x1,y1,x2,y2, x3,y3,x4,y4 ) {
  var x = ((x1*y2-y1*x2)*(x3-x4)-(x1-x2)*(x3*y4-y3*x4))/((x1-x2)*(y3-y4)-(y1-y2)*(x3-x4));
  var y = ((x1*y2-y1*x2)*(y3-y4)-(y1-y2)*(x3*y4-y3*x4))/((x1-x2)*(y3-y4)-(y1-y2)*(x3-x4));
  if (isNaN(x)||isNaN(y)) {
    return false;
  } else {
    if (x1>=x2) {
      if (!(x2<=x&&x<=x1)) {return false;}
    } else {
      if (!(x1<=x&&x<=x2)) {return false;}
    }
    if (y1>=y2) {
      if (!(y2<=y&&y<=y1)) {return false;}
    } else {
      if (!(y1<=y&&y<=y2)) {return false;}
    }
    if (x3>=x4) {
      if (!(x4<=x&&x<=x3)) {return false;}
    } else {
      if (!(x3<=x&&x<=x4)) {return false;}
    }
    if (y3>=y4) {
      if (!(y4<=y&&y<=y3)) {return false;}
    } else {
      if (!(y3<=y&&y<=y4)) {return false;}
    }
  }
  return true;
}

// Returns true if the line segment defined by point1 and point2
// intersects any line segment defined in path.
// point1 and point2 are 2D arrays containing the coordinates of two points.
// path is an array of 2D points and defines a continuous path.
function lineIntersectsPath( point1, point2, path ) {
  var linesIntersect = false;
  for (var i=1; i < path.length; i++) {
    linesIntersect = lineIntersection( point1[0], point1[1],
                                       point2[0], point2[1],
                                       path[i][0], path[i][1],
                                       path[i-1][0], path[i-1][1]
    ) || linesIntersect;
    if ( linesIntersect ) { return true; }
  }
  return false;
}

// Tests if a 2D point lies on a 2D line segment
function isPointOnLine( pt, line ) {
  return pt[0] === line[0][0] && pt[1] === line[0][1] || //point is line[0]
                                           pt[0] === line[1][0] && pt[1] === line[1][1] || //point is line[1]
                                                                             pt[0] === line[0][0] && pt[0] === line[1][0]   &&   Math.min(line[0][1],line[1][1]) < pt[1] && pt[1] < Math.max(line[0][1],line[1][1]) || //point on vertical line (all same x-coordinate)
                                                                                                               pt[1] === line[0][1] && pt[1] === line[1][1]   &&   Math.min(line[0][0],line[1][0]) < pt[0] && pt[0] < Math.max(line[0][0],line[1][0]) || //point on horizontal line (all same y-coordinate)
                                                                                                                                                 ( (line[1][1] - line[0][1]) / (line[1][0] - line[0][0]) * (pt[0] - line[0][0]) / (pt[1] - line[0][1]) ) === 1   &&   Math.min(line[0][0],line[1][0]) < pt[0] && pt[0] < Math.max(line[0][0],line[1][0])   &&   Math.min(line[0][1],line[1][1]) < pt[1] && pt[1] < Math.max(line[0][1],line[1][1]); //point on slope
}

// Tests if a 2D point is contained within a 2D polygon
// http://jsfromhell.com/math/is-point-in-poly
function isPointInPoly( pt, poly ) {
  for ( var c = false, i = -1, l = poly.length, j = l - 1; ++i < l; j = i ) {
    ( (poly[i][1] <= pt[1] && pt[1] < poly[j][1]) || (poly[j][1] <= pt[1] && pt[1] < poly[i][1]) ) &&
    ( pt[0] < (poly[j][0] - poly[i][0]) * (pt[1] - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0] ) &&
    ( c = !c );
  }
  return c;
}



/* Date slider */



// Create jQuery UI date slider.
// Only need to call this once per page load.
function createDateSlider() {
  $dateSlider.slider({
    animate: 200,
    min: 0,
    orientation: "horizontal",
    range: true,
    step: 1,
    slide: function( event, ui ) {
      var whichHandle = $( ui.handle ).is( $dateSliderLower ) ? -1 : 1;
      var handleValues = ui.values;
      if ( dateLocked ) { // set other handle's value based on this one's
                          handleValues[ ( 1 - whichHandle ) / 2 ] = ui.value - whichHandle * ( dateRange - 1 );
        // reject slide event if handle values would be outside the slider min/max
        if ( handleValues[0] < $dateSlider.slider( "option", "min" ) || $dateSlider.slider( "option", "max" ) < handleValues[1] ) {
          return false;
        }
        // set handle values
        $(this).slider( "values", handleValues );
      }
      // reject slide if handles would overlap
      if ( handleValues[1] == handleValues[0] ) {
        return false;
      }
      // set handle text
      updateDateItems( handleValues );
      // rebind data, and project onto current dimensions
      bindData( handleValues );
      projectPoints();
      drawLines( handleValues );
    }
  });
}

// Update slider (on game change)
function updateDateSlider() {
  var minValue = Math.max(0, gameData.length - 80);
  $dateSlider.slider( "option", {
    max: gameData.length - 1,
    values: [minValue, gameData.length - 1]
  });
  updateDateItems( $dateSlider.slider( "values" ) );
}

// Update handle text and date-count text using handle values
function updateDateItems( values ) {
  $dateSliderLower.text( gameData[ values[0] ][ "date" ] );
  $dateSliderUpper.text( gameData[ values[1] ][ "date" ] );
  var count = values[1] - values[0] + 1;
  $dateCount.text( count + " draw" + ( count === 1 ? "" : "s" ) );
}

// Lock date slider
$dateLockInput.on( "change", function() {
  dateLocked = $(this).is(":checked");
  var values = $dateSlider.slider( "values" );
  dateRange = values[1] - values[0] + 1;
});



/* Trajectory */



$trajectoryToggle.on( "change", "#trajectory-on, #trajectory-off", function() {
  if ( $("input[name=trajectory]:checked").val() === "on" ) {
    trajectoryMode = 1;
  } else {
    trajectoryMode = 0;
  }
  drawLines();
});



/* Quick Pick */



// Get one random number from the given range, inclusive
function random( range ) {
  var min = range[0], max = range[1];
  return min + Math.floor( Math.random() * (max - min + 1) );
}

// Test given numbers against all slices in all dimensions.
// Returns an array of 2D arrays representing the dimension pairs where the numbers failed.
// numbers should be an array of integers.
function verifyNumbers( numbers ) {
  var fails = [];
  Object.keys( sliceData ).forEach( function(key1) {
    Object.keys( sliceData[key1] ).forEach( function(key2) {
      var passed = false;
      if ( sliceData[key1][key2].length === 0 ) { //no slices; numbers pass by default
                                                  passed = true;
      } else { //check slices in this dimension pair
               var currentPoint = [numbers[key1], numbers[key2]];
        var i = 0;
        while ( !passed && i < sliceData[key1][key2].length ) {
          var currentSlice = sliceData[key1][key2][i]["points"];

          // test if point is inside slice
          if ( isPointInPoly( currentPoint, currentSlice ) ) {
            passed = true; //numbers pass this dimension
          }

          // test if point is on slice path
          var j = 1; //start from first line (second point)
          while ( !passed && j < currentSlice.length ) {
            var currentLine = [currentSlice[j-1], currentSlice[j]];
            if ( isPointOnLine( currentPoint, currentLine ) ) {
              passed = true; //numbers pass this dimension
            }
            j++;
          }
          i++;
        }
      }
      if ( !passed ) { //numbers failed in this dimension
                       fails.push( [key1, key2] );
      }
    });
  });
  return fails;
}

// Click quick pick button to generate one set of random numbers
$quickpickButton.on("click", function() {

  // get random numbers
  var randomNumbers = [], randomNumber, randomBonus;
  while ( randomNumbers.length < gameInfo["number-count"] ) {
    randomNumber = random( gameInfo["number-range"] );
    if ( randomNumbers.indexOf( randomNumber ) < 0 ) {
      randomNumbers.push( randomNumber );
    }
  }

  // sort numbers (by value)
  randomNumbers.sort( function(a,b) { return a - b; } );

  // get random bonus numbers
  while ( randomNumbers.length < gameInfo["number-count"] + gameInfo["bonus-count"] ) {
    randomBonus = random( gameInfo["bonus-range"] );
    if ( randomNumbers.indexOf( randomBonus, gameInfo["number-count"] ) < 0 ) {
      randomNumbers.push( randomBonus );
    }
  }

  // add quickpick to quickpicks
  quickpicks.push({
    "id": new Date().getTime(),
    "numbers": randomNumbers,
    "failures": []
  });

  testQuickpicks();
  updateQuickpicks();
  drawQuickpickPoints();
});

// Tests each quickpick against all slices in all dimensions
function testQuickpicks() {for ( var i = 0; i < quickpicks.length; i++ ) {
  quickpicks[i]["failures"] = verifyNumbers( quickpicks[i]["numbers"] );
}
}

function updateQuickpicks() {
  var d3$quickpickNumbers = d3$quickpickNumbersContainer.selectAll( ".quickpick-number" ).data( quickpicks, function(d) { return d["id"]; } );

  d3$quickpickNumbers.enter()
                     .insert( "span", ".quickpick-number:first-child" )
                     .classed( "quickpick-number", true )
                     .style( "opacity", 0 )
                     .each( function(d) {
                       d3.select(this).append( "span" ).classed( "quickpick-number-delete", true )
                         .attr( "title", "Delete" )
                         .datum( d["id"] )
                         .on( "click", function(d) {
                           // Remove quickpick with the given id
                           quickpicks = $.grep( quickpicks, function(el) { return el["id"] != d; } );

                           updateQuickpicks();
                           drawQuickpickPoints();
                         });
                       d3.select(this).append( "span" ).classed( "quickpick-number-header", true );
                       d3$quickpickBody = d3.select(this).append( "span" ).classed( "quickpick-number-body", true );
                       for ( var i = 0; i < d["numbers"].length; i++ ) {
                         d3$quickpickBody.append( "span" ).classed( "ball", true )
                                         .classed( "bonus", function() {
                                           return i >= gameInfo["number-count"];
                                         })
                                         .text( padNumber( d["numbers"][i], 2 ) );//zero-padded to two digits
                       }
                     })
    // flash corresponding point on click
                     .on( "click", function(d) {
                       // stop all numbers from flashing
                       d3$quickpickNumbersContainer.selectAll( ".quickpick-number" ).classed( "flashing", false);

                       var id = d["id"];
                       d3$quickpickPointsGroup.selectAll(".quickpick-point")
                                              .each( function() {
                                                // stop all other points from flashing
                                                d3.select(this).classed( "flashing", false );
                                              })
                                              .filter( function(d) { return d["id"] == id; })
                                              .each( function() { flash(this); });
                     });

  d3$quickpickNumbers
        .classed( "fail", function(d) { return d["failures"].length > 0; } )
        .each( function(d) {
          d3.select(this).selectAll(".quickpick-number-header").text( function() {
            // Report failed dimensions, if any
            if ( d["failures"].length === 0 ) {
              return "Passed";
            } else {
              var failPairs = [];
              for ( var i = 0; i < d["failures"].length; i++ ) {
                var failDim1 = parseInt(d["failures"][i][0]) + 1;
                var failDim2 = parseInt(d["failures"][i][1]) + 1;
                failDim1 = failDim1 > gameInfo["number-count"] ? " Bonus" : "#" + failDim1;
                failDim2 = failDim2 > gameInfo["number-count"] ? " Bonus" : "#" + failDim2;
                failPairs.push( "[" + failDim1 + "," + failDim2 + "]" );
              }
              return "Failed: " + failPairs.join(" ");
            }
          });
        })
        .transition()
        .duration(300)
        .ease( "back" )
        .style( "opacity", 1 );

  d3$quickpickNumbers.exit()
                     .transition()
                     .duration(400)
                     .style( "opacity", 0 )
                     .style( "border-color", "white" )
                     .remove();
}

function drawQuickpickPoints() {
  var d3$quickpickPoints = d3$quickpickPointsGroup.selectAll(".quickpick-point").data( quickpicks, function(d) { return d["id"]; } );

  d3$quickpickPoints.enter()
                    .append( "circle" )
                    .classed("quickpick-point", true)
    // flash corresponding quickpick number on click
                    .on( "click", function(d) {
                      // stop all points from flashing
                      d3$quickpickPointsGroup.selectAll(".quickpick-point").classed( "flashing", false);

                      var id = d["id"];
                      d3$quickpickNumbersContainer.selectAll( ".quickpick-number" )
                                                  .each( function() {
                                                    // stop all other numbers from flashing
                                                    d3.select(this).classed( "flashing", false );
                                                  })
                                                  .filter( function(d) { return d["id"] == id; })
                                                  .each( function() {
                                                    flash(this);
                                                  });
                    });

  d3$quickpickPoints
        .classed( "fail", function(d) { return d["failures"].length > 0; } )
        .attr( "cx", function(d) { return xScale(d["numbers"][xDimension]); } )
        .attr( "cy", function(d) { return yScale(d["numbers"][yDimension]); } )
        .attr( "r", rQuickpick );

  d3$quickpickPoints.exit().remove();
}



// Flash element
function flash( element ) {
  d3$element = d3.select( element );
  d3$element.classed( "flashing", true );
  setTimeout( function() {
    d3$element.classed( "flashing", false );
  }, 200);
  setTimeout( function() {
    d3$element.classed( "flashing", true );
  }, 400);
  setTimeout( function() {
    d3$element.classed( "flashing", false );
  }, 600);
  setTimeout( function() {
    d3$element.classed( "flashing", true );
  }, 800);
  setTimeout( function() {
    d3$element.classed( "flashing", false );
  }, 1000);
}



/* On page load */
createDateSlider();
changeGame( "pb" );//default to powerball

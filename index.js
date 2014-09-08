'use strict';

var _ = require('underscore');

function prepareSubschema(type, required) {
	type = type || _.values(type);

	var data = {
		type        : { type: String },
		coordinates : []
	};

	if(typeof type === 'string') {
		data.type.default = type;
	} else {
		data.type.enum = type;
		data.type.default = type[0];
	}

	if(type === 'Point') {
		data.coordinates.push({ type: Number });
	} else {
		data.coordinates.push({ type: [] });
	}

	if(required) {
		data.type.required = true;
	}

	return data;
}


module.exports = function geoJSONPlugin (schema, options) {
	if(!options) {
		options = {};
	}

	var type = options.type || null,
		required = options.required || false,
		path = options.path || 'location',
		index = options.index || {
			type: '2dsphere', 
			sparse: true
		};

	var subSchema = prepareSubschema(type, required);

	schema.path(path, subSchema);
	schema.path(path).index(index);

	return schema;
};

var type = module.exports.type = {
	POINT: 'Point',
	LINE_STRING: 'LineString',
	POLYGON: 'Polygon',

	MULTI_POINT: 'MultiPoint',
	MULTI_LINE_STRING: 'MultiLineString',
	MULTI_POLYGON: 'MultiPolygon'
};


/**
 * Validate point structure
 * @param  {Array}  point Point coordinates [longitude, latitude]
 * @return {Boolean}       [description]
 */
var isPoint = module.exports.isPoint = function(point) {
	if(!_.isArray(point) || point.length !== 2 
		|| !_.isNumber(point[0]) || !_.isNumber(point[1]) ) {
		return false;
	}

	return true;
};

/**
 * Return true if each of points is valid point
 * @param  {Array}  points Array of points [[longitude1, latitude1], [longitude2, latitude2]]
 * @return {Boolean}        
 */
var arePoints = module.exports.arePoints = function(points) {
	if(!_.isArray(points) || points.length === 0) {
		return false;
	}

	for(var i=0; i<points.length; i++) {
		if(!isPoint(points[i])) {
			return false;
		}
	}

	return true;
};


/**
 * Create point object that can be stored in mongodb 
 * @param  {Array} point Point coordinates [longitude, latitude]
 * @return {Object}      Object that can be stored as location in mongodb
 */
var createPoint = module.exports.createPoint = function(point) {
	if(!isPoint(point)) {
		throw new Error('Point has no valid format');	
	}

	return {
		type: type.POINT,
		coordinates: point
	};
};

/**
 * Create line string object that can be stored in mongodb 
 * @param  {Array} point1 First point coordinates [longitude, latitude]
 * @param  {Array} point2 LAst point coordinates [longitude, latitude]
 * @return {Object}      Object that can be stored as location in mongodb
 */
var createLineString = module.exports.createLineString = function(point1, point2) {
	if(!arePoints([point1, point2])) {
		throw new Error('One of points has no valid format');	
	}

	return {
		type: type.LINE_STRING,
		coordinates: [point1, point2]
	};
};

/**
 * Create polygon object that can be stored in mongodb 
 * @param  {Array} ring Array of points coordinates [longitude, latitude]
 * @return {Object}      Object that can be stored as location in mongodb
 */
var createPolygon = module.exports.createPolygon = function(ring) {
	if(!arePoints(ring)) {
		throw new Error('One of points has no valid format');	
	}

	return {
		type: type.POLYGON,
		coordinates: [[ring]]
	};
};


var distanceMultiplier = module.exports.distanceMultiplier = 6378137;

/**
 * Convert meters to radians
 * @param  {Number} m Meters
 * @return {Number}   Radians
 */
var meterToRadian = module.exports.meterToRadian = function(m) {
	return m/distanceMultiplier;
};


/**
 * Convert polygon to boundary box
 * @param  {Array} points Array of points
 * @return {Array}        Array of [top,left] coordinates and [bottom, right] coordinates
 */
var polygonToBoundary = module.exports.polygonToBoundary = function(points) {
	var left = null,
		right = null,
		top = null,
		bottom = null;

	if(!arePoints(points)) {
		throw new Error('One of points has no valid format');	
	}

	for(var i=0; i<points.length; i++) {
		var point = points[i];

		if(point.lat<left || left === null) left = point.lat;
		if(point.lat>right || right === null) right = point.lat;

		if(point.lng<top || top === null) top = point.lng;
		if(point.lng>bottom || bottom === null) bottom = point.lng;
	}

	return [[top, left], [bottom, right]];
};

/**
 * Convert polygon to closed boundary polygon
 * @param  {Array} points Array of points
 * @return {Array}        Array of closed boundary points
 */
var polygonToBoundaryPolygon = module.exports.polygonToBoundary = function(points) {
	var boundary = polygonToBoundary(points);
	var topLeft = boundary[0];
	var bottomRight = boundary[1];

	return [
		topLeft,
		[topLeft[0], bottomRight[1]],
		[bottomRight],
		[bottomRight[0], topLeft[1]],
		topLeft
	];
};
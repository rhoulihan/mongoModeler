/**
 * MongoDB Index Modeler - Document Operations
 * 
 * This file contains functions for managing documents,
 * including adding, deleting, and modifying documents and attributes.
 */

// ===================================================================
// Document Addition/Removal
// ===================================================================

/**
 * Entry point for adding an item via UI
 * 
 * @param {string} id - ID reference (unused)
 */
function addItemClick(id) {
    pasteItem = {};
    addItem(id);
}

/**
 * Removes a document from the collection
 * 
 * @param {string} id - Cell ID reference for the document to delete
 */
function deletePartition(id) {
    // Don't allow deleting new documents
    if (cellId[id].obj[table.primary_key] === "~new~") {
        alert("New partitions cannot be deleted.");
        return;
    }

    // Set up confirmation dialog
    alertData = {
        caller: "deletePartition",
        data: cellId[id].obj[table.primary_key]
    };

    $("#alertTitle h1").text("Delete Document");
    $("#alertText").text(`The '${alertData.data}' document will be deleted, continue?`);

    $("#alertModal").show();
}

/**
 * Opens the document editor for a cell
 * 
 * @param {string} id - Cell ID
 */
function editDocument(id) {
    // Clone object without display values
    delete cellId[id].obj.dispVals;
    
    // Initialize JSON editor with object
    jsonEditor = new JsonEditor("#documentJSON", cellId[id].obj);
    
    // Show the editor modal
    $("#editDocument").show();
    
    // Ensure proper binding when dialog is opened
    $("#btnSaveEditedDocument").off('click').on('click', function() {
        saveDocument();
    });
}

/**
 * Removes an attribute from a document or entity type
 * 
 * @param {boolean} applyAll - Whether to apply to all documents of this type
 */
function removeAttr(applyAll) {
    var PK = selectId.PK;
    var attr = selectId.attr;
    var type = "";

    // Snapshot model state
    makeChange();
    
    // Find the document and remove attribute
    json_data.forEach(function(obj) {
        if (obj[table.primary_key] === PK) {
            delete obj[attr];
            type = obj.type;
            return false;
        }
    });

    // Apply to all documents of this type if requested
    if (applyAll) {
        json_data.forEach(function(obj) {
            if (obj["type"] === type) {
                delete obj[attr];
            }
        });
        
        // Remove from schema
        if (schema.models[type]) {
            delete schema.models[type][attr];
        }
    }

    // Move focus to sort key and reload
    selectId.attr = table.sort_key;
    $("#removeAttributeModal").hide();
    loadDataModel();
}

/**
 * Removes a specific item from the collection
 * 
 * @param {string} id - Cell ID reference for the item to delete
 */
function deleteItem(id) {
    var PK = cellId[id].obj[table.primary_key];
    var SK = cellId[id].obj[table.sort_key];
    var message = "";

    // Don't allow deleting from new partitions
    if (PK === "~new~") {
        message = "Items cannot be deleted from new partitions.";
    }

    if (message !== "") {
        alert(message);
        loadDataModel();
        return;
    }

    // Set up confirmation dialog
    alertData = {
        caller: "deleteItem",
        data: id
    };

    $("#alertTitle h1").text("Delete Item");
    $("#alertText").text(`Item key '${PK}, ${SK}' will be deleted, continue?`);

    $("#alertModal").show();
}

/**
 * Finds a document by cell ID
 * 
 * @param {string} id - Cell ID reference
 * @return {Object|null} Document object or null if not found
 */
function findItemByCellId(id) {
    var item = null;
    
    json_data.forEach(function(obj) {
        if (obj[table.primary_key] === cellId[id].PK && 
            obj[table.sort_key] === cellId[id].SK) {
            item = obj;
            return false;  // Break from forEach
        }
    });

    return item;
}

// ===================================================================
// Value Template Management
// ===================================================================

/**
 * Shows the value template editing dialog
 * 
 * @param {string} id - Cell ID reference
 */
function showValueTemplate(id) {
    alertData.data = {};
    alertData.caller = cellId[id].attr;

    // Clear select options
    $('#selectType')
        .find('option')
        .remove()
        .end()
        .append('<option selected="true" disabled="disabled">--Select a Type--</option>');

    // Handle primary key templates
    if (alertData.caller === table.primary_key) {
        $("#txtMapFunction").prop("disabled", true);
        $("#btnDefineMap").prop("disabled", true);

        // Add all entity types to dropdown
        Object.keys(schema.models).forEach(function(type) {
            $("#selectType").append($('<option></option>').val(type).html(type));
        });
        
        $("#selectTypeDiv").show();
    } else {
        // Get item type and set up label
        var item = findItemByCellId(id);
        alertData.data.type = item.type;
        $("#lblEditMap").text(
            `Enter Mapping Function for '${alertData.data.type}.${alertData.caller}' attribute:`
        );
    }

    // Load existing value templates
    if (alertData.caller === table.sort_key) {
        if (datamodel.KeyAttributes && 
            datamodel.KeyAttributes.SortKey && 
            datamodel.KeyAttributes.SortKey.hasOwnProperty("MapFunction") &&
            datamodel.KeyAttributes.SortKey.MapFunction.hasOwnProperty(alertData.data.type)) {
                $("#txtMapFunction").val(
                    datamodel.KeyAttributes.SortKey.MapFunction[alertData.data.type]
                );
        }
    } else if (datamodel.NonKeyAttributes) {
        datamodel.NonKeyAttributes.forEach(function(obj) {
            if (obj.AttributeName === alertData.caller && 
                obj.hasOwnProperty("MapFunction") &&
                obj.MapFunction.hasOwnProperty(alertData.data.type)) {
                    $("#txtMapFunction").val(obj.MapFunction[alertData.data.type]);
            }
        });
    }

    // Show the dialog
    $("#defineValueTemplateDiv").show();
    $("#txtMapFunction").focus();
}

/**
 * Updates the entity type in the mapping function dialog
 */
function setType() {
    // Load template for selected type if exists
    if (datamodel.KeyAttributes && 
        datamodel.KeyAttributes.PartitionKey && 
        datamodel.KeyAttributes.PartitionKey.hasOwnProperty("MapFunction") &&
        datamodel.KeyAttributes.PartitionKey.MapFunction.hasOwnProperty($("#selectType").val())) {
            $("#txtMapFunction").val(
                datamodel.KeyAttributes.PartitionKey.MapFunction[$("#selectType").val()]
            );
    }

    // Enable form controls
    $("#txtMapFunction").prop("disabled", false);
    $("#btnDefineMap").prop("disabled", false);
    
    // Update type reference and label
    alertData.data.type = $("#selectType").val();
    $("#lblEditMap").text(
        `Enter Mapping Function for '${alertData.data.type}.${alertData.caller}' attribute:`
    );
    
    $("#txtMapFunction").focus();
}

// ===================================================================
// Document Generation
// ===================================================================

/**
 * Creates documents based on template specification
 * 
 * @param {Object} spec - Document generation specification
 * @return {Array} Generated documents
 */
function makeDocuments(spec) {
    // Instantiate random data generator
    var chance = new Chance();
    var docsToInsert = [];
     
    // Generate the specified number of documents
    for (var i = 0; i < (spec.numDocs || 10); i++) {
        var doc = {};
       
        // Generate attributes based on spec
        Object.keys(spec.doc).forEach(function(key) {
           doc[key] = getAttrValue(spec.doc[key], spec.options);
        });

        docsToInsert.push(doc);
    }
    
    return docsToInsert;
}

/**
 * Generates attribute values based on spec
 * 
 * @param {*} field - Field specification
 * @param {Object} options - Generation options
 * @return {*} Generated attribute value
 */
function getAttrValue(field, options) {
    // Handle array fields
    if (Array.isArray(field)) {
        var currentArray = [];
        var upperLimit = parseInt(Object.keys(field[0])[0]);

        for (var item = 0; item < upperLimit; item++) {
            field.forEach(function(key) {
                currentArray.push(getAttrValue(key[upperLimit.toString()], options));
            });
        }
        
        return currentArray;
    }

    // Handle object fields
    if (typeof field === "object") {
        var currentObj = {};
        
        Object.keys(field).forEach(function(key) {
            currentObj[key] = getAttrValue(field[key], options);
        });

        return currentObj;
    }
      
    // Handle primitives
    field = field.toLowerCase();
    switch (field) {
        case 'objectid':
            return new BSON.ObjectId();
        
        case 'date':
            return new Date(chance.date(options[field] || {year: 2022}));
        
        case 'geo':
            return { 
                type: "Point", 
                coordinates: [ 
                    chance.longitude(options[field] || undefined), 
                    chance.latitude(options[field] || undefined) 
                ] 
            };
        
        default:
            return chance[field](options[field] || undefined);
    }
}

// ===================================================================
// Modal Dialog Response Handling
// ===================================================================

/**
 * Handles responses from modal dialogs
 * 
 * @param {boolean} applyAll - Whether to apply changes to all items of type
 */
function postResponse(applyAll) {
    // Hide all modals
    $(".modal").hide();

    var newData = [];

    switch (alertData.caller) {
        case "saveDocument":
            // Handle document editor schema changes
            if (applyAll) {
                // Process deleted attributes
                alertData.data.deletedAttrs.forEach(function(attr) {
                    // Remove from schema
                    delete schema.models[alertData.data.type][attr];

                    // Remove from all documents of this type
                    json_data.forEach(function(doc) {
                        if (doc.type === alertData.data.type) {
                            delete doc[attr];
                        }
                    });
                });

                // Process new attributes
                alertData.data.newAttrs.forEach(function(attr) {
                    // Add to schema
                    schema.models[alertData.data.type][attr] = { type: 'String' };

                    // Add to all other documents of this type
                    json_data.forEach(function(document) {
                        if (document["type"] === alertData.data.type && 
                            document["_id"] !== alertData.data.callerId) {
                            document[attr] = "~new~";
                        }
                    });
                });
            }

            loadDataModel();
            break;

        case "createModel":
            if (applyAll === '0') {
                $("#createModelDiv").show();
            }
            break;

        case "deletePartition":
            // Create new array without deleted document
            json_data.forEach(function(obj) {
                if (obj["_id"] !== alertData.data) {
                    newData.push(obj);
                }
            });
            break;

        case "cutItem":
        case "copyItem":
        case "deleteItem":
            var PK = cellId[alertData.data].obj[table.primary_key];

            // Create new array without deleted item
            json_data.forEach(function(obj) {
                if (obj[table.primary_key] === PK) {
                    pasteItem = obj;
                } else {
                    newData.push(obj);
                }
            });
            break;

        default:
            alertData = "";
            break;
    }

    // Apply changes for delete/cut operations
    if (alertData.caller.startsWith("delete") || alertData.caller.startsWith("cut")) {
        showValues = true;
        makeChange();
        model.DataModel[modelIndex].CollectionData = newData;
        loadDataModel();
        pasteItem = alertData.caller === "cutItem" ? pasteItem : {};
    }
}
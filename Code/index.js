/*
 * Node.js Lambda backed AWS CloudFormation Custom Resource to create an S3 configuration file, either
 * by putting parameter data from the CloudFormation template or copying a source S3 file. 
 *
 * When deploying an AWS stack with CloudFormation, it can be helpful to wrtie configuration data to a file, eg perhaps you have
 * CloudFormation template parameters you want to persist to an S3 file to configure the application being deployed.  Another 
 * option can be to copy a particular configuration fil eto a target file, eg you may have dev, uat and prod versions of a config file.
 * The following CloudFormation template demonstrates this:
 *
 * https://s3-ap-northeast-1.amazonaws.com/au-com-thinkronicity-opencode-apne1/au-com-thinkronicity-PutS3File-Sample.template *
 *  
 * This template loads the code from a bucket in the AWS region the Stack is being deployed in. 
 * 
 * These buckets are readable by any AWS account.
 * 
 * Ian_MacDonald_Hogan@yahoo.com
 *
 */
console.log('Loading function PutS3File');

var https = require('https');
var url = require('url');

// Function to send a response to the pre-signed S3 URL provided by the request.
var sendResponse = function(event, context, responseStatus, responseData, physicalResourceId) {
    var responseBody = JSON.stringify({
        Status: responseStatus,
        Reason: "See the details in CloudWatch Log Stream: " + context.logStreamName,
        PhysicalResourceId: physicalResourceId || context.logStreamName,
        StackId: event.StackId,
        RequestId: event.RequestId,
        LogicalResourceId: event.LogicalResourceId,
        Data: responseData || {Result: "Empty Response"}
    });

    console.log('RESPONSE BODY:\n', responseBody);
    
    if (event.ResponseURL) {

        var parsedUrl = url.parse(event.ResponseURL);
        var options = {
            hostname: parsedUrl.hostname,
            port: 443,
            path: parsedUrl.path,
            method: 'PUT',
            headers: {
                'Content-Type': '',
                'Content-Length': responseBody.length
            }
        };
    
        var req = https.request(options, function(res) {
            console.log('STATUS:', res.statusCode);
            console.log('HEADERS:', JSON.stringify(res.headers));
            context.succeed('Successfully sent stack response!');
        });
    
        req.on('error', function(err) {
            console.log('sendResponse Error:\n', err);
            context.fail(err);
        });
    
        req.write(responseBody);
        req.end();
    }
    else {
        console.log('Warning - no ResponseURL in event!');
    }
};

// Request handler function
exports.handler = function(event, context) {
    console.log('Received event:', JSON.stringify(event, null, 2));
    
    var responseStatus = 'FAILED';
    var responseData = {"_self_version": "1.0"};

// Catch any error to make sure we respond to the request.
    try {
        
        // Get the deletion policy if one is provided.
        var deletionPolicy = event.DeletionPolicy || "Delete";
        
        // Handle delete request when deletion policy is Retain - this is easy! 
        if (event.RequestType === 'Delete' && deletionPolicy === 'Retain') {
            responseStatus = 'SUCCESS';
            responseData.Result = 'Delete requires no action when deletion policy is Retain.';
            sendResponse(event, context, responseStatus, responseData, event.physicalResourceId);
            return;
        }
    
        // Get source and target properties.
        var source = event.ResourceProperties.Source;
        var target = event.ResourceProperties.Target;
    
        var aws = require('aws-sdk'); 
        
        var s3 = new aws.S3(); 

        // Load common parameters.
        var params = {
             Bucket: target.Bucket
            ,Key: target.Key
        };

        var physicalResourceName = 'S3://'+params.Bucket+'/'+params.Key;
        var physicalResourceId = event.physicalResourceId || physicalResourceName+':'+event.RequestId;
        
        if (event.RequestType === 'Delete' && deletionPolicy === 'Delete') {
            
            s3.deleteObject(params, function(err, data) {
                if (err) {
                    responseData.Error = 'PutS3File call to delete object failed';
                    console.log(responseData.Error + ":\n", err);
                } else {
                    // Populates the return data with the outputs from the specified stack
                    responseStatus = 'SUCCESS';
                    responseData.Result = 'Deleted File '+physicalResourceName;
                }
                sendResponse(event, context, responseStatus, responseData, physicalResourceId);
            });        
        }
        else {
        
            // Add target ACL if one is provided.
            if (target.ACL) {
                params.ACL = target.ACL;
            }
        
            // Default operation
            var operation = 'put';

            // Callback function for S3 operations.
            function callBack(err, data) {
                if (err) {
                    responseData.Error ='PutS3File call to '+operation+' object failed';
                    console.log(responseData.Error + ":\n", err);
                } else {
                    // Populates the return data with the outputs from the specified stack
                    responseStatus = 'SUCCESS';
                    responseData.Result = event.RequestType+'d File'+physicalResourceName;
                }
                sendResponse(event, context, responseStatus, responseData, physicalResourceId);
            };
            
            // Handle copy and put alternatives.
            if (source.S3Url) {
            
                operation = 'copy';
                params.CopySource = source.S3Url;
                s3.copyObject(params, callBack);  

            } else {
                params.Body = source.filetext;
                params.ContentType = source.contentType;
    
                s3.putObject(params, callBack);
            }
        }
    } catch(ex) {
        responseData.Error = ex.name + ': ' + ex.message;
        console.log(responseData.Error);
        sendResponse(event, context, responseStatus, responseData);
    }
};


# PutS3File

Node.js Lambda backed AWS CLoudFormation Custom Resource to create an S3 file from specified content.

When deploying an AWS stack with CloudFormation, it can be helpful to write configuration data to a file, eg perhaps you have
CloudFormation template parameters you want to persist to an S3 file to configure the application being deployed. Another 
option can be to copy a particular configuration fil eto a target file, eg you may have dev, uat and prod versions of a config file.
The following CloudFormation template demonstrates this:
  
  https://s3-ap-northeast-1.amazonaws.com/au-com-thinkronicity-opencode-apne1/au-com-thinkronicity-PutS3File-Sample.template
  
  This template loads the code from a bucket in the AWS region the Stack is being deployed in. 
  
  These buckets are readable by any AWS account.
  
 Ian_MacDonald_Hogan@yahoo.com
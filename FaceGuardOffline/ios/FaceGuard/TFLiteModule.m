#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(TFLiteModule, NSObject)

RCT_EXTERN_METHOD(loadModel:(NSString *)modelName
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(runBlazeFace:(NSString *)base64Frame
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(runMobileFaceNet:(NSString *)base64Face
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(runMiniFASNet:(NSString *)base64Face
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

@end

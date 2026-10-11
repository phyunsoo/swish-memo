const fs = require('fs');
const path = require('path');
const { withXcodeProject, withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins');
const plist = require('@expo/plist').default;

const TARGET = 'SwishTodoWidget';

module.exports = function withTodoWidget(config) {
  const bundleId = config.ios.bundleIdentifier;
  const group = `group.${bundleId}`;
  config = withEntitlementsPlist(config, (mod) => {
    mod.modResults['com.apple.security.application-groups'] = [...new Set([
      ...(mod.modResults['com.apple.security.application-groups'] ?? []), group,
    ])];
    return mod;
  });
  config = withInfoPlist(config, (mod) => {
    mod.modResults.SwishMemoAppGroup = group;
    return mod;
  });
  return withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    const root = mod.modRequest.projectRoot;
    const directory = path.join(mod.modRequest.platformProjectRoot, TARGET);
    fs.mkdirSync(directory, { recursive: true });
    fs.copyFileSync(path.join(root, 'widgets/TodoWidget.swift'), path.join(directory, 'TodoWidget.swift'));
    fs.copyFileSync(path.join(root, 'modules/liquid-glass-wheel/ios/SharedMemoStore.swift'), path.join(directory, 'SharedMemoStore.swift'));
    fs.writeFileSync(path.join(directory, `${TARGET}.entitlements`), plist.build({
      'com.apple.security.application-groups': [group],
    }));
    fs.writeFileSync(path.join(directory, 'Info.plist'), plist.build({
      CFBundleDisplayName: '투두리스트',
      CFBundleIdentifier: '$(PRODUCT_BUNDLE_IDENTIFIER)',
      CFBundleName: '$(PRODUCT_NAME)',
      CFBundleExecutable: '$(EXECUTABLE_NAME)',
      CFBundlePackageType: 'XPC!',
      CFBundleShortVersionString: config.version ?? '1.0.0',
      CFBundleVersion: config.ios.buildNumber ?? '1',
      SwishMemoAppGroup: group,
      NSExtension: { NSExtensionPointIdentifier: 'com.apple.widgetkit-extension' },
    }));
    let targetEntry = Object.entries(project.pbxNativeTargetSection())
      .find(([key, value]) => !key.endsWith('_comment') && value.name?.replaceAll('"', '') === TARGET);
    if (!targetEntry) {
      const target = project.addTarget(TARGET, 'app_extension', TARGET, `${bundleId}.todo-widget`);
      project.addBuildPhase([`${TARGET}/TodoWidget.swift`, `${TARGET}/SharedMemoStore.swift`], 'PBXSourcesBuildPhase', 'Sources', target.uuid);
      project.addBuildPhase([], 'PBXFrameworksBuildPhase', 'Frameworks', target.uuid);
      project.addBuildPhase([], 'PBXResourcesBuildPhase', 'Resources', target.uuid);
      targetEntry = [target.uuid, target.pbxNativeTarget];
    }
    const configurationList = project.pbxXCConfigurationList()[targetEntry[1].buildConfigurationList];
    for (const reference of configurationList.buildConfigurations) {
      const settings = project.pbxXCBuildConfigurationSection()[reference.value].buildSettings;
      Object.assign(settings, {
        PRODUCT_BUNDLE_IDENTIFIER: `"${bundleId}.todo-widget"`,
        INFOPLIST_FILE: `"${TARGET}/Info.plist"`,
        CODE_SIGN_ENTITLEMENTS: `"${TARGET}/${TARGET}.entitlements"`,
        IPHONEOS_DEPLOYMENT_TARGET: '17.0',
        SWIFT_VERSION: '5.0',
        TARGETED_DEVICE_FAMILY: '1',
        APPLICATION_EXTENSION_API_ONLY: 'YES',
        GENERATE_INFOPLIST_FILE: 'NO',
        CODE_SIGN_STYLE: 'Automatic',
        OTHER_LDFLAGS: ['"$(inherited)"', '"-lsqlite3"'],
        CLANG_ENABLE_MODULES: 'YES',
      });
      if (config.ios.appleTeamId) settings.DEVELOPMENT_TEAM = config.ios.appleTeamId;
    }
    const mainList = project.pbxXCConfigurationList()[project.getFirstTarget().firstTarget.buildConfigurationList];
    for (const reference of mainList.buildConfigurations) {
      project.pbxXCBuildConfigurationSection()[reference.value].buildSettings.IPHONEOS_DEPLOYMENT_TARGET = '17.0';
    }
    return mod;
  });
};

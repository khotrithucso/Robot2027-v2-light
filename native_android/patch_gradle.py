import pathlib
import re

# 1. Nâng minSdkVersion lên 24 để Android NDK hỗ trợ POSIX_MADV_*
vars_path = pathlib.Path("android/variables.gradle")
if vars_path.exists():
    vars_content = vars_path.read_text(encoding="utf-8")
    vars_content = re.sub(r"minSdkVersion\s*=\s*\d+", "minSdkVersion = 24", vars_content)
    vars_path.write_text(vars_content, encoding="utf-8")
    print("Updated minSdkVersion to 24!")

# 2. Cấu hình CMake NDK trong android/app/build.gradle
gradle_path = pathlib.Path("android/app/build.gradle")
content = gradle_path.read_text(encoding="utf-8")

extra_blocks = '''
    defaultConfig {
        ndk {
            abiFilters "arm64-v8a"
        }
    }
    externalNativeBuild {
        cmake {
            path "src/main/cpp/CMakeLists.txt"
        }
    }
'''

if "externalNativeBuild" not in content:
    content = content.replace("android {", "android {" + extra_blocks, 1)
    gradle_path.write_text(content, encoding="utf-8")
    print("Patched android/app/build.gradle!")

# 3. Bật GPU Hardware Acceleration, HTTP API (XAMPP DDNS) và quyền Micro trong AndroidManifest.xml
manifest_path = pathlib.Path("android/app/src/main/AndroidManifest.xml")
if manifest_path.exists():
    m_content = manifest_path.read_text(encoding="utf-8")
    if "usesCleartextTraffic" not in m_content:
        m_content = m_content.replace(
            "<application",
            '<application android:usesCleartextTraffic="true" android:hardwareAccelerated="true"',
            1
        )
    if "RECORD_AUDIO" not in m_content:
        m_content = m_content.replace(
            "</manifest>",
            '    <uses-permission android:name="android.permission.RECORD_AUDIO" />\n</manifest>'
        )
    manifest_path.write_text(m_content, encoding="utf-8")
    print("Patched AndroidManifest.xml for GPU Hardware Acceleration, HTTP & Mic!")

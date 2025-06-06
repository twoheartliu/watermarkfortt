import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { saveAs } from 'file-saver'

/**
 * 为PDF添加水印
 * @param {File} file - 上传的PDF文件
 * @param {Object} watermarkOptions - 水印配置选项
 * @param {string} watermarkOptions.text - 水印文本
 * @param {string} watermarkOptions.color - 水印颜色 (RGB格式，如 "0.5,0.5,0.5" 或 十六进制 "#808080")
 * @param {number} watermarkOptions.opacity - 水印透明度 (0-1)
 * @param {number} watermarkOptions.fontSize - 水印字体大小
 * @param {number} watermarkOptions.rotation - 水印旋转角度
 * @param {number} watermarkOptions.density - 水印密度 (1-5)
 * @returns {Promise<void>} - 返回Promise
 */
export async function addWatermarkToPDF(file, watermarkOptions) {
  try {
    // 默认水印配置 - 使用更明显的默认值
    const options = {
      text: watermarkOptions.text || '水印文本',
      color: watermarkOptions.color || '#000000', // 默认黑色，使用十六进制格式
      opacity: parseFloat(watermarkOptions.opacity) || 0.5, // 确保是数字
      fontSize: parseInt(watermarkOptions.fontSize) || 50, // 确保是数字
      rotation: parseInt(watermarkOptions.rotation) || -45, // 确保是数字
      density: parseInt(watermarkOptions.density) || 3, // 确保是数字
    }

    console.log('水印配置:', options)
    console.log('透明度类型:', typeof options.opacity)

    // 读取文件
    const fileData = await readFileAsArrayBuffer(file)

    // 加载PDF文档
    const pdfDoc = await PDFDocument.load(fileData)

    // 注册fontkit
    pdfDoc.registerFontkit(fontkit)

    // 尝试加载中文字体 - 使用本地黑体字体
    let font
    let useChineseFont = true
    try {
      // 加载本地黑体字体
      const fontPath = '/src/assets/fonts/simhei.ttf'
      console.log('尝试加载本地黑体字体:', fontPath)
      const fontResponse = await fetch(fontPath)

      if (!fontResponse.ok) {
        throw new Error(`无法加载本地字体: ${fontResponse.statusText}`)
      }

      const fontData = await fontResponse.arrayBuffer()
      font = await pdfDoc.embedFont(fontData)
      console.log('成功加载中文黑体字体')
    } catch (fontError) {
      console.error('加载中文字体失败，回退到标准字体:', fontError)
      // 如果中文字体加载失败，回退到标准字体
      font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      useChineseFont = false

      // 如果水印文本包含中文，替换为英文
      if (/[\u4e00-\u9fa5]/.test(options.text)) {
        options.text = 'CONFIDENTIAL' // 替换为英文水印
      }
    }

    console.log('解析颜色:', options.color)
    const watermarkColor = parseColor(options.color)
    console.log('解析后的颜色对象:', watermarkColor)

    // 获取页数
    const pages = pdfDoc.getPages()
    console.log(`处理PDF，共${pages.length}页`)

    // 为每一页添加水印
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]
      const { width, height } = page.getSize()
      console.log(`处理第${i + 1}页，尺寸: ${width}x${height}`)

      // 根据密度生成水印网格
      const positions = generateWatermarkPositions(
        width,
        height,
        options.fontSize,
        options.density
      )

      // 在每个位置添加水印
      for (const pos of positions) {
        page.drawText(options.text, {
          x: pos.x,
          y: pos.y,
          size: pos.size,
          font,
          opacity: options.opacity, // 确保是数字
          color: watermarkColor,
          rotate: degrees(options.rotation),
        })
      }

      // 如果使用的是中文字体，则不需要添加测试水印
      if (!useChineseFont) {
        // 添加一个完全不透明的水印在右上角作为测试
        page.drawText('TEST WATERMARK', {
          x: width - 200,
          y: height - 50,
          size: 20,
          font: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
          opacity: 1.0, // 完全不透明
          color: rgb(1, 0, 0), // 红色
        })
      }
    }

    console.log('水印添加完成，准备保存文档')

    // 保存修改后的PDF
    const modifiedPdfBytes = await pdfDoc.save()

    // 创建Blob并下载
    const blob = new Blob([modifiedPdfBytes], { type: 'application/pdf' })
    saveAs(blob, `watermarked_${file.name}`)

    console.log('文档已保存并下载')
    return true
  } catch (error) {
    console.error('添加水印时出错:', error)
    throw error
  }
}

/**
 * 解析颜色值，支持RGB格式和十六进制格式
 * @param {string} colorStr - 颜色字符串
 * @returns {RGB} - PDF-lib RGB颜色对象
 */
function parseColor(colorStr) {
  // 默认黑色
  let r = 0,
    g = 0,
    b = 0

  try {
    // 检查是否是十六进制格式
    if (colorStr.startsWith('#')) {
      // 移除#前缀
      const hex = colorStr.substring(1)

      // 解析十六进制颜色
      if (hex.length === 3) {
        // 短格式 #RGB
        r = parseInt(hex[0] + hex[0], 16) / 255
        g = parseInt(hex[1] + hex[1], 16) / 255
        b = parseInt(hex[2] + hex[2], 16) / 255
      } else if (hex.length === 6) {
        // 长格式 #RRGGBB
        r = parseInt(hex.substring(0, 2), 16) / 255
        g = parseInt(hex.substring(2, 4), 16) / 255
        b = parseInt(hex.substring(4, 6), 16) / 255
      } else {
        console.warn('无效的十六进制颜色格式，使用默认黑色')
      }

      console.log(`解析十六进制颜色 ${colorStr} 为 RGB: ${r}, ${g}, ${b}`)
    } else {
      // 尝试解析为RGB格式 (0.5,0.5,0.5)
      const colorValues = colorStr.split(',').map(Number)

      // 验证颜色值
      if (colorValues.length >= 3 && !colorValues.some((v) => isNaN(v))) {
        r = colorValues[0]
        g = colorValues[1]
        b = colorValues[2]

        // 确保值在0-1范围内
        r = Math.max(0, Math.min(1, r))
        g = Math.max(0, Math.min(1, g))
        b = Math.max(0, Math.min(1, b))

        console.log(`解析RGB颜色 ${colorStr} 为: ${r}, ${g}, ${b}`)
      } else {
        console.warn('无效的RGB颜色格式，使用默认黑色')
      }
    }
  } catch (e) {
    console.warn('解析颜色出错，使用默认黑色:', e)
  }

  // 确保所有颜色值都在0-1范围内
  r = Math.max(0, Math.min(1, r))
  g = Math.max(0, Math.min(1, g))
  b = Math.max(0, Math.min(1, b))

  return rgb(r, g, b)
}

/**
 * 根据密度生成水印位置
 * @param {number} width - 页面宽度
 * @param {number} height - 页面高度
 * @param {number} fontSize - 字体大小
 * @param {number} density - 水印密度 (1-5)
 * @returns {Array} - 水印位置数组
 */
function generateWatermarkPositions(width, height, fontSize, density) {
  const positions = []

  // 始终添加中心水印
  positions.push({ x: width / 2, y: height / 2, size: fontSize * 1.5 })

  // 始终添加四个角落的水印
  positions.push({ x: 100, y: height - 100, size: fontSize }) // 左上角
  positions.push({ x: width - 100, y: height - 100, size: fontSize }) // 右上角
  positions.push({ x: 100, y: 100, size: fontSize }) // 左下角
  positions.push({ x: width - 100, y: 100, size: fontSize }) // 右下角

  // 如果密度大于1，添加更多水印
  if (density > 1) {
    // 根据密度调整网格大小
    const gridSize = Math.max(2, density * 2)

    // 计算水印间距
    const spacingX = width / gridSize
    const spacingY = height / gridSize

    // 生成水印网格
    for (let row = 0; row <= gridSize; row++) {
      for (let col = 0; col <= gridSize; col++) {
        // 计算水印位置
        const x = col * spacingX
        const y = row * spacingY

        // 避免与已有水印重复
        const isDuplicate = positions.some(
          (pos) => Math.abs(pos.x - x) < 50 && Math.abs(pos.y - y) < 50
        )

        if (!isDuplicate) {
          positions.push({ x, y, size: fontSize })
        }
      }
    }
  }

  // 如果密度为4或5，添加对角线水印
  if (density >= 4) {
    const diagonalCount = density * 2

    // 对角线1 (左下到右上)
    for (let i = 0; i <= diagonalCount; i++) {
      const x = (width / diagonalCount) * i
      const y = (height / diagonalCount) * i

      // 避免与已有水印重复
      const isDuplicate = positions.some(
        (pos) => Math.abs(pos.x - x) < 50 && Math.abs(pos.y - y) < 50
      )

      if (!isDuplicate) {
        positions.push({ x, y, size: fontSize })
      }
    }

    // 对角线2 (左上到右下)
    for (let i = 0; i <= diagonalCount; i++) {
      const x = (width / diagonalCount) * i
      const y = height - (height / diagonalCount) * i

      // 避免与已有水印重复
      const isDuplicate = positions.some(
        (pos) => Math.abs(pos.x - x) < 50 && Math.abs(pos.y - y) < 50
      )

      if (!isDuplicate) {
        positions.push({ x, y, size: fontSize })
      }
    }
  }

  // 密度5时，添加更多随机水印
  if (density === 5) {
    const extraWatermarks = 15 // 额外添加的随机水印数量

    for (let i = 0; i < extraWatermarks; i++) {
      const x = Math.random() * width
      const y = Math.random() * height

      positions.push({
        x,
        y,
        size: fontSize * (0.8 + Math.random() * 0.4), // 大小有细微变化
      })
    }
  }

  return positions
}

/**
 * 将文件读取为ArrayBuffer
 * @param {File} file - 文件对象
 * @returns {Promise<ArrayBuffer>} - 返回ArrayBuffer的Promise
 */
function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsArrayBuffer(file)
  })
}
